// ============================================================
// VSUSTAIN SOLAR — CONFIGURATION
// Update these values when endpoints or form IDs change
// ============================================================

const CONFIG = {

  // Google Apps Script Web App URL (your deployed script)
  SHEET_API_URL: "https://script.google.com/macros/s/AKfycbzZpdk4ErxIrKD13YI7ahIRK8QrpmrvwfmTuq4eDz8zgAzZMEt0JIAX5uHqLsqE0I2l/exec",

  // n8n Webhook URL (for execution stage text updates)
  N8N_WEBHOOK_URL: "https://vsustainsolar.app.n8n.cloud/webhook/94dfaea7-0f7c-4ea8-92fc-6495ae61b4ca",

  // Google Form base URL for on-site execution stage (photo upload)
  // Entry IDs:
  //   entry.1661817092 = Customer Name
  //   entry.117915841  = Project ID (Record ID)
  //   entry.748494691  = Phone number
  GOOGLE_FORM_BASE: "https://docs.google.com/forms/d/e/1FAIpQLSeN3sWI5rEX4pYmwSYGsW55nPQ-PzGSu9MT1Ob_oAP0ukVt2w/viewform",
  FORM_ENTRY_NAME:    "entry.1661817092",
  FORM_ENTRY_ID:      "entry.117915841",
  FORM_ENTRY_PHONE:   "entry.748494691",

  // Sheet column mapping (0-indexed, matches your Apps Script output)
  // Update these if you change the column order in the sheet
  COLUMNS: {
    TIMESTAMP:        0,
    RECORD_ID:        1,
    PROJECT_NAME:     2,
    PROJECT_ID:       3,
    CUSTOMER_NAME:    4,
    PHONE:            5,
    EMAIL:            6,
    ADDRESS_STREET:   7,
    ADDRESS_CITY:     8,
    ADDRESS_STATE:    9,
    ADDRESS_ZIP:      10,
    ADDRESS_COUNTRY:  11,
    PROJECT_TYPE:     12,
    SANCTIONED_LOAD:  13,
    TOTAL_AMOUNT:     14,
    ADVANCE_AMOUNT:   15,
    EXECUTION_STAGE:  16,
    PROJECT_LEAD:     17,
    STATUS:           18,
  },

  // Project Execution Stages (overall project progress)
  EXECUTION_STAGES: [
    "Advance received",
    "Procurement done and Team assigned",
    "Execution day 1",
    "Execution day 2",
    "Execution day 3",
    "Feedback Taken",
    "Subsidy amount received",
  ],

  // On-Site Execution Stages (physical work stages — needs photo)
  ONSITE_STAGES: [
    "Material Delivered",
    "Payment 2 done",
    "Structure setup",
    "Panel mounting",
    "Electrical wiring",
    "ACDB DCDB setup",
    "Inverter-UPS-Battery installation",
    "Earthing",
  ],

};
