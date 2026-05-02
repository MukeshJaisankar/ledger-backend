from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import re
import csv
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import pandas as pd

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import mm

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------- Categorization rules ----------
CATEGORY_RULES = [
    ("Food & Dining", ["zomato", "swiggy", "dominos", "kfc", "mcdonald", "pizza", "restaurant", "cafe", "starbucks", "barbeque", "burger"]),
    ("Groceries", ["bigbasket", "dmart", "blinkit", "zepto", "grofers", "instamart", "reliance fresh", "more retail", "spencer"]),
    ("Transport", ["uber", "ola", "rapido", "metro", "irctc", "petrol", "diesel", "fuel", "hp ", "iocl", "bpcl", "indianoil"]),
    ("Shopping", ["amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho", "tata cliq", "shoppers stop"]),
    ("Entertainment", ["netflix", "spotify", "hotstar", "prime video", "sonyliv", "zee5", "bookmyshow", "pvr", "inox", "youtube"]),
    ("Bills & Utilities", ["electricity", "water bill", "gas bill", "mobile", "recharge", "broadband", "wifi", "airtel", "jio", "vodafone", "vi ", "tata power", "adani electricity", "bescom", "msedcl"]),
    ("Rent", ["rent", "nobroker", "lease"]),
    ("EMI & Loan", ["emi", "loan", "bajaj fin", "hdfc loan", "homeloan"]),
    ("Health", ["pharmacy", "apollo", "medplus", "1mg", "pharmeasy", "hospital", "clinic", "dr ", "doctor"]),
    ("Travel", ["makemytrip", "goibibo", "yatra", "indigo", "vistara", "spicejet", "airindia", "oyo", "airbnb"]),
    ("Investment", ["zerodha", "groww", "upstox", "kuvera", "mutualfund", "sip ", "nps ", "ppf"]),
    ("Education", ["udemy", "coursera", "byju", "unacademy", "school", "college", "tuition"]),
    ("Income", ["salary", "payroll", "stipend", "interest credit", "dividend", "refund"]),
    ("Transfer", ["upi", "neft", "imps", "rtgs", "transfer to", "p2a", "p2m"]),
]

DEFAULT_CATEGORY = "Other"

def categorize(description: str, txn_type: str) -> str:
    desc = (description or "").lower()
    if txn_type == "income":
        for kw in ["salary", "payroll", "stipend", "dividend", "interest credit", "refund"]:
            if kw in desc:
                return "Income"
    for cat, keywords in CATEGORY_RULES:
        for kw in keywords:
            if kw in desc:
                return cat
    return DEFAULT_CATEGORY


def extract_merchant(description: str) -> str:
    if not description:
        return "Unknown"
    desc = description.strip()
    desc = re.sub(r"\s+", " ", desc)
    # Strip common bank prefixes
    desc = re.sub(r"^(UPI|NEFT|IMPS|RTGS|POS|ATM|ECS|ACH)[-/:\s]*", "", desc, flags=re.IGNORECASE)
    # Take first meaningful chunk
    parts = re.split(r"[-/|]", desc)
    merchant = parts[0].strip() if parts else desc
    # Remove trailing reference numbers
    merchant = re.sub(r"\b\d{6,}\b", "", merchant).strip()
    return (merchant[:48] or "Unknown").title()


# ---------- Models ----------
class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # ISO date YYYY-MM-DD
    description: str
    merchant: str
    amount: float  # absolute value
    type: Literal["expense", "income"]
    category: str
    source: str = "upload"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TransactionUpdate(BaseModel):
    category: Optional[str] = None
    merchant: Optional[str] = None
    description: Optional[str] = None


class Budget(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str
    monthly_limit: float
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class BudgetCreate(BaseModel):
    category: str
    monthly_limit: float


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Ledger API"}


@api_router.post("/upload-statement")
async def upload_statement(file: UploadFile = File(...)):
    content = await file.read()
    fname = (file.filename or "").lower()
    try:
        if fname.endswith(".xlsx") or fname.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(content))
        else:
            # try multiple encodings
            text = None
            for enc in ["utf-8", "utf-8-sig", "latin-1"]:
                try:
                    text = content.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            if text is None:
                raise HTTPException(400, "Unable to decode file")
            df = pd.read_csv(io.StringIO(text))
    except Exception as e:
        raise HTTPException(400, f"Failed to parse file: {e}")

    # Normalize column names
    df.columns = [str(c).strip().lower() for c in df.columns]

    def find_col(candidates):
        for c in candidates:
            for col in df.columns:
                if c in col:
                    return col
        return None

    date_col = find_col(["date", "txn date", "transaction date", "value date"])
    desc_col = find_col(["description", "narration", "particulars", "details", "remarks"])
    debit_col = find_col(["debit", "withdraw", "dr ", "dr amount"])
    credit_col = find_col(["credit", "deposit", "cr ", "cr amount"])
    amount_col = find_col(["amount", "amt"])
    type_col = find_col(["type", "dr/cr", "drcr"])

    if not date_col or not desc_col:
        raise HTTPException(400, f"CSV must include date and description/narration columns. Found: {list(df.columns)}")

    inserted = 0
    skipped = 0
    docs = []
    for _, row in df.iterrows():
        try:
            raw_date = row[date_col]
            if pd.isna(raw_date):
                skipped += 1
                continue
            try:
                date_val = pd.to_datetime(raw_date, dayfirst=True, errors="coerce")
            except Exception:
                date_val = None
            if date_val is None or pd.isna(date_val):
                skipped += 1
                continue
            date_str = date_val.strftime("%Y-%m-%d")
            description = str(row[desc_col]).strip()
            if not description or description.lower() == "nan":
                skipped += 1
                continue

            txn_type = "expense"
            amount = 0.0
            if debit_col and credit_col:
                debit_val = pd.to_numeric(row.get(debit_col), errors="coerce")
                credit_val = pd.to_numeric(row.get(credit_col), errors="coerce")
                debit_val = 0 if pd.isna(debit_val) else float(debit_val)
                credit_val = 0 if pd.isna(credit_val) else float(credit_val)
                if credit_val > 0:
                    txn_type = "income"
                    amount = credit_val
                else:
                    txn_type = "expense"
                    amount = debit_val
            elif amount_col:
                amt = pd.to_numeric(row[amount_col], errors="coerce")
                if pd.isna(amt):
                    skipped += 1
                    continue
                amt = float(amt)
                if type_col and not pd.isna(row.get(type_col)):
                    t = str(row[type_col]).strip().lower()
                    txn_type = "income" if t in ("cr", "credit", "income") else "expense"
                    amount = abs(amt)
                else:
                    txn_type = "income" if amt > 0 else "expense"
                    amount = abs(amt)
            else:
                skipped += 1
                continue

            if amount <= 0:
                skipped += 1
                continue

            merchant = extract_merchant(description)
            category = categorize(description, txn_type)
            txn = Transaction(
                date=date_str,
                description=description,
                merchant=merchant,
                amount=round(amount, 2),
                type=txn_type,
                category=category,
                source="upload",
            )
            docs.append(txn.model_dump())
            inserted += 1
        except Exception:
            skipped += 1

    if docs:
        await db.transactions.insert_many(docs)

    return {"inserted": inserted, "skipped": skipped}


@api_router.get("/transactions", response_model=List[Transaction])
async def list_transactions(
    category: Optional[str] = None,
    type: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 1000,
):
    q = {}
    if category:
        q["category"] = category
    if type:
        q["type"] = type
    if start or end:
        q["date"] = {}
        if start:
            q["date"]["$gte"] = start
        if end:
            q["date"]["$lte"] = end
    if search:
        q["$or"] = [
            {"description": {"$regex": search, "$options": "i"}},
            {"merchant": {"$regex": search, "$options": "i"}},
        ]
    cursor = db.transactions.find(q, {"_id": 0}).sort("date", -1).limit(limit)
    return await cursor.to_list(length=limit)


@api_router.patch("/transactions/{txn_id}", response_model=Transaction)
async def update_transaction(txn_id: str, body: TransactionUpdate):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "No updates")
    res = await db.transactions.find_one_and_update(
        {"id": txn_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    if not res:
        raise HTTPException(404, "Not found")
    return res


@api_router.delete("/transactions/{txn_id}")
async def delete_transaction(txn_id: str):
    res = await db.transactions.delete_one({"id": txn_id})
    return {"deleted": res.deleted_count}


@api_router.delete("/transactions")
async def clear_all_transactions():
    res = await db.transactions.delete_many({})
    return {"deleted": res.deleted_count}


# ---------- AI Recategorize ----------
class RecatRequest(BaseModel):
    only_other: bool = True  # only recategorize 'Other' bucket
    limit: int = 100


@api_router.post("/recategorize")
async def recategorize(body: RecatRequest):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    import json as _json

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured")

    q = {"category": DEFAULT_CATEGORY} if body.only_other else {}
    txns = await db.transactions.find(q, {"_id": 0}).limit(body.limit).to_list(body.limit)
    if not txns:
        return {"updated": 0, "examined": 0}

    categories = [c[0] for c in CATEGORY_RULES] + [DEFAULT_CATEGORY]
    items = [{"id": t["id"], "description": t["description"], "type": t["type"]} for t in txns]

    system_msg = (
        "You are a strict transaction categorizer for an Indian personal finance app. "
        f"Categories (pick exactly one per transaction): {', '.join(categories)}. "
        "Use 'Income' for credits like salary/dividend/refund. "
        "Use 'Transfer' only for plain UPI/NEFT transfers with no merchant context. "
        "Respond with a single JSON object of shape {\"results\": [{\"id\": \"...\", \"category\": \"...\"}]} "
        "and absolutely nothing else — no prose, no markdown."
    )
    chat = LlmChat(
        api_key=api_key,
        session_id=f"recat-{uuid.uuid4().hex[:8]}",
        system_message=system_msg,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    user_text = "Categorize these transactions:\n" + _json.dumps(items, ensure_ascii=False)
    try:
        response = await chat.send_message(UserMessage(text=user_text))
    except Exception as e:
        raise HTTPException(502, f"LLM error: {e}")

    # extract JSON from response
    text = response if isinstance(response, str) else str(response)
    text = text.strip()
    # strip code fences if present
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()
    try:
        parsed = _json.loads(text)
    except Exception:
        # try to find JSON object
        m = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not m:
            raise HTTPException(502, "LLM returned non-JSON response")
        parsed = _json.loads(m.group(0))

    results = parsed.get("results", [])
    valid_set = set(categories)
    updated = 0
    for r in results:
        cat = r.get("category")
        rid = r.get("id")
        if not rid or cat not in valid_set:
            continue
        res = await db.transactions.update_one({"id": rid}, {"$set": {"category": cat}})
        if res.modified_count:
            updated += 1
    return {"updated": updated, "examined": len(items)}


@api_router.get("/dashboard")
async def dashboard():
    txns = await db.transactions.find({}, {"_id": 0}).to_list(10000)
    if not txns:
        return {
            "total_income": 0, "total_expense": 0, "balance": 0, "txn_count": 0,
            "by_category": [], "monthly": [], "top_merchants": [],
            "current_month": {"income": 0, "expense": 0},
        }
    total_income = sum(t["amount"] for t in txns if t["type"] == "income")
    total_expense = sum(t["amount"] for t in txns if t["type"] == "expense")

    by_cat = defaultdict(float)
    for t in txns:
        if t["type"] == "expense":
            by_cat[t["category"]] += t["amount"]
    by_category = sorted(
        [{"category": k, "amount": round(v, 2)} for k, v in by_cat.items()],
        key=lambda x: -x["amount"]
    )

    by_month = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
    for t in txns:
        ym = t["date"][:7]  # YYYY-MM
        by_month[ym][t["type"]] += t["amount"]
    monthly = [
        {"month": m, "income": round(v["income"], 2), "expense": round(v["expense"], 2)}
        for m, v in sorted(by_month.items())
    ]

    by_merchant = defaultdict(float)
    for t in txns:
        if t["type"] == "expense":
            by_merchant[t["merchant"]] += t["amount"]
    top_merchants = sorted(
        [{"merchant": k, "amount": round(v, 2)} for k, v in by_merchant.items()],
        key=lambda x: -x["amount"]
    )[:8]

    # current month
    now = datetime.now(timezone.utc)
    cur_ym = now.strftime("%Y-%m")
    cur = by_month.get(cur_ym, {"income": 0.0, "expense": 0.0})

    return {
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "balance": round(total_income - total_expense, 2),
        "txn_count": len(txns),
        "by_category": by_category,
        "monthly": monthly,
        "top_merchants": top_merchants,
        "current_month": {"income": round(cur["income"], 2), "expense": round(cur["expense"], 2)},
    }


@api_router.get("/categories")
async def list_categories():
    return [c[0] for c in CATEGORY_RULES] + [DEFAULT_CATEGORY]


# ---------- Budgets ----------
@api_router.get("/budgets")
async def list_budgets():
    budgets = await db.budgets.find({}, {"_id": 0}).to_list(1000)
    # compute current-month spend per budget
    now = datetime.now(timezone.utc)
    cur_ym = now.strftime("%Y-%m")
    pipeline_match = {"type": "expense", "date": {"$regex": f"^{cur_ym}"}}
    txns = await db.transactions.find(pipeline_match, {"_id": 0, "category": 1, "amount": 1}).to_list(10000)
    spend_by_cat = defaultdict(float)
    for t in txns:
        spend_by_cat[t["category"]] += t["amount"]
    for b in budgets:
        spent = round(spend_by_cat.get(b["category"], 0.0), 2)
        b["spent"] = spent
        b["remaining"] = round(b["monthly_limit"] - spent, 2)
        b["percent"] = round((spent / b["monthly_limit"] * 100) if b["monthly_limit"] else 0, 1)
        b["over_budget"] = spent > b["monthly_limit"]
    return budgets


@api_router.post("/budgets", response_model=Budget)
async def create_budget(body: BudgetCreate):
    existing = await db.budgets.find_one({"category": body.category}, {"_id": 0})
    if existing:
        await db.budgets.update_one({"category": body.category}, {"$set": {"monthly_limit": body.monthly_limit}})
        existing["monthly_limit"] = body.monthly_limit
        return existing
    b = Budget(category=body.category, monthly_limit=body.monthly_limit)
    await db.budgets.insert_one(b.model_dump())
    return b


@api_router.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str):
    res = await db.budgets.delete_one({"id": budget_id})
    return {"deleted": res.deleted_count}


# ---------- Recurring detection ----------
@api_router.get("/recurring")
async def recurring():
    txns = await db.transactions.find({"type": "expense"}, {"_id": 0}).to_list(10000)
    groups = defaultdict(list)
    for t in txns:
        key = t["merchant"].lower()
        groups[key].append(t)

    recurring_list = []
    for merchant, items in groups.items():
        if len(items) < 2:
            continue
        # sort by date
        items_sorted = sorted(items, key=lambda x: x["date"])
        # date diffs in days
        dates = [datetime.strptime(t["date"], "%Y-%m-%d") for t in items_sorted]
        diffs = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
        if not diffs:
            continue
        avg_diff = sum(diffs) / len(diffs)
        amounts = [t["amount"] for t in items_sorted]
        avg_amount = sum(amounts) / len(amounts)
        # consider recurring if avg gap between 25-35 days (monthly) or 6-8 days (weekly)
        if 25 <= avg_diff <= 35 or 6 <= avg_diff <= 8 or 13 <= avg_diff <= 16:
            cadence = "Monthly" if 25 <= avg_diff <= 35 else ("Bi-weekly" if 13 <= avg_diff <= 16 else "Weekly")
            recurring_list.append({
                "merchant": items_sorted[-1]["merchant"],
                "category": items_sorted[-1]["category"],
                "avg_amount": round(avg_amount, 2),
                "last_date": items_sorted[-1]["date"],
                "occurrences": len(items_sorted),
                "cadence": cadence,
            })
    recurring_list.sort(key=lambda x: -x["avg_amount"])
    return recurring_list


# ---------- Export ----------
@api_router.get("/export/csv")
async def export_csv():
    txns = await db.transactions.find({}, {"_id": 0}).sort("date", -1).to_list(100000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Description", "Merchant", "Category", "Type", "Amount (INR)"])
    for t in txns:
        writer.writerow([t["date"], t["description"], t["merchant"], t["category"], t["type"], t["amount"]])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ledger_export.csv"},
    )


@api_router.get("/export/pdf")
async def export_pdf():
    txns = await db.transactions.find({}, {"_id": 0}).sort("date", -1).to_list(100000)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('title', parent=styles['Heading1'], fontSize=22, leading=26, textColor=colors.black, spaceAfter=4)
    sub_style = ParagraphStyle('sub', parent=styles['Normal'], fontSize=9, textColor=colors.grey, spaceAfter=12)

    elements = [
        Paragraph("THE LEDGER — STATEMENT", title_style),
        Paragraph(f"Generated {datetime.now(timezone.utc).strftime('%d %b %Y')} • {len(txns)} transactions", sub_style),
    ]

    total_income = sum(t["amount"] for t in txns if t["type"] == "income")
    total_expense = sum(t["amount"] for t in txns if t["type"] == "expense")

    summary_data = [
        ["INCOME", "EXPENSE", "BALANCE"],
        [f"Rs {total_income:,.2f}", f"Rs {total_expense:,.2f}", f"Rs {(total_income-total_expense):,.2f}"],
    ]
    summary_table = Table(summary_data, colWidths=[60 * mm, 60 * mm, 60 * mm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.black),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTSIZE', (0, 1), (-1, 1), 13),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 16))

    data = [["DATE", "DESCRIPTION", "CATEGORY", "TYPE", "AMOUNT (INR)"]]
    for t in txns[:200]:
        data.append([t["date"], (t["description"] or "")[:40], t["category"], t["type"].upper(), f"{t['amount']:,.2f}"])
    table = Table(data, colWidths=[22 * mm, 70 * mm, 35 * mm, 18 * mm, 30 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.black),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('ALIGN', (4, 0), (4, -1), 'RIGHT'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
    ]))
    elements.append(table)
    doc.build(elements)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=ledger_statement.pdf"},
    )


# ---------- Demo seeder ----------
@api_router.post("/seed-demo")
async def seed_demo():
    await db.transactions.delete_many({})
    samples = [
        # current month and previous months
        ("Salary Credit - Acme Corp Payroll", 85000, "income", 1),
        ("UPI/SWIGGY/ORDER123/Food order", 480, "expense", 2),
        ("UPI/ZOMATO/ORDER555", 720, "expense", 3),
        ("UPI/UBER INDIA/RIDE", 320, "expense", 4),
        ("UPI/OLA CABS/RIDE556", 285, "expense", 5),
        ("UPI/BLINKIT/ORDER", 1245, "expense", 6),
        ("UPI/BIGBASKET/GROCERY", 2890, "expense", 7),
        ("NETFLIX SUBSCRIPTION", 649, "expense", 1),
        ("SPOTIFY PREMIUM", 119, "expense", 5),
        ("HDFC HOMELOAN EMI", 24500, "expense", 5),
        ("NOBROKER RENT PAYMENT", 32000, "expense", 3),
        ("AMAZON SHOPPING", 1899, "expense", 9),
        ("FLIPKART ORDER", 2499, "expense", 10),
        ("UPI/DMART/GROCERY", 3450, "expense", 12),
        ("INDIANOIL FUEL PETROL", 2200, "expense", 11),
        ("APOLLO PHARMACY", 540, "expense", 14),
        ("AIRTEL POSTPAID RECHARGE", 599, "expense", 15),
        ("BESCOM ELECTRICITY BILL", 1850, "expense", 18),
        ("PVR INOX TICKETS", 850, "expense", 20),
        ("UPI/SWIGGY/ORDER888", 540, "expense", 22),
        ("UPI/STARBUCKS COFFEE", 380, "expense", 23),
        ("ZERODHA INVESTMENT SIP", 10000, "expense", 5),
        ("MAKEMYTRIP FLIGHT BOOKING", 8499, "expense", 25),
        ("Interest Credit - SB Account", 412, "income", 28),
    ]
    now = datetime.now(timezone.utc)
    docs = []
    # generate for current and previous 2 months
    for month_offset in range(0, 3):
        base = (now.replace(day=1) - timedelta(days=month_offset * 30))
        for desc, amt, typ, day in samples:
            try:
                d = base.replace(day=min(day, 27))
            except ValueError:
                d = base
            txn = Transaction(
                date=d.strftime("%Y-%m-%d"),
                description=desc,
                merchant=extract_merchant(desc),
                amount=float(amt),
                type=typ,
                category=categorize(desc, typ),
                source="demo",
            )
            docs.append(txn.model_dump())
    await db.transactions.insert_many(docs)
    return {"inserted": len(docs)}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
