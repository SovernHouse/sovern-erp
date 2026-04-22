# Bank Integration API Documentation

## Overview
The Bank Integration API provides Letter of Credit (LC) operations for the Trading ERP system. All endpoints require authentication and return standardized JSON responses.

## Base URL
```
/api/bank
```

## Authentication
All endpoints require an `Authorization` header with a valid JWT token:
```
Authorization: Bearer {token}
```

---

## Endpoints

### 1. Submit LC Application
**POST** `/lc/apply`

Submit a new Letter of Credit application to the issuing bank.

#### Request Body
```json
{
  "lcAmount": 50000,
  "currency": "USD",
  "buyerBankCode": "CHASE001",
  "applicantDetails": {
    "name": "ABC Trading Company",
    "address": "123 Main St, New York, NY",
    "contact": "john@abctrading.com"
  },
  "beneficiary": {
    "name": "XYZ Tile Suppliers",
    "address": "456 Trade Ave, Shanghai, China",
    "contact": "sales@xyztiles.com"
  },
  "validity": "2024-06-15",
  "port": "Port of Shanghai",
  "documents": [
    {
      "type": "commercial_invoice",
      "filename": "invoice.pdf",
      "url": "/uploads/invoice.pdf"
    }
  ]
}
```

#### Response
```json
{
  "success": true,
  "submissionId": "uuid-string",
  "bankReference": "LC-1710723456-ABC123DEF",
  "status": "pending",
  "estimatedProcessingDays": 5,
  "message": "LC application submitted successfully"
}
```

#### Status Codes
- **201 Created**: Application accepted
- **400 Bad Request**: Missing required fields or validation error
- **401 Unauthorized**: Missing or invalid authentication

---

### 2. Check LC Status
**GET** `/lc/{bankReference}/status`

Check the current status of an LC application.

#### Path Parameters
- `bankReference` (string): Bank reference from submission response

#### Response
```json
{
  "success": true,
  "bankReference": "LC-1710723456-ABC123DEF",
  "status": "under_review",
  "lastUpdated": "2024-03-17T10:30:00Z",
  "comments": "Application is under review by the bank compliance team",
  "nextSteps": [
    "Monitor status updates",
    "Ensure beneficiary information is accurate"
  ]
}
```

#### Status Values
- `pending`: Application received, awaiting review
- `under_review`: Compliance team reviewing application
- `approved`: LC has been issued
- `rejected`: Application rejected
- `amended`: LC has been amended

#### Status Codes
- **200 OK**: Status retrieved successfully
- **404 Not Found**: LC reference not found
- **401 Unauthorized**: Missing or invalid authentication

---

### 3. Submit Documents
**POST** `/lc/{bankReference}/documents`

Submit required documents for LC negotiation.

#### Path Parameters
- `bankReference` (string): Bank reference from submission response

#### Request Body
```json
{
  "documents": [
    {
      "type": "commercial_invoice",
      "filename": "invoice.pdf",
      "content": "base64-encoded-pdf",
      "issueDate": "2024-03-10"
    },
    {
      "type": "bill_of_lading",
      "filename": "bol.pdf",
      "content": "base64-encoded-pdf",
      "shipmentDate": "2024-03-12"
    },
    {
      "type": "packing_list",
      "filename": "packing.pdf",
      "content": "base64-encoded-pdf"
    },
    {
      "type": "certificate_of_origin",
      "filename": "coo.pdf",
      "content": "base64-encoded-pdf",
      "issuingCountry": "China"
    },
    {
      "type": "insurance_certificate",
      "filename": "insurance.pdf",
      "content": "base64-encoded-pdf",
      "coverage": "100%"
    }
  ]
}
```

#### Response
```json
{
  "success": true,
  "submissionId": "uuid-string",
  "bankReference": "LC-1710723456-ABC123DEF",
  "discrepancies": [],
  "status": "accepted",
  "message": "All documents accepted"
}
```

#### Discrepancy Example
```json
{
  "success": true,
  "submissionId": "uuid-string",
  "bankReference": "LC-1710723456-ABC123DEF",
  "discrepancies": [
    {
      "type": "insurance_certificate",
      "message": "Missing required document: insurance certificate",
      "severity": "error"
    }
  ],
  "status": "pending_correction",
  "message": "Some documents need correction"
}
```

#### Required Document Types
- `commercial_invoice`: Invoice issued by seller
- `bill_of_lading`: Proof of shipment
- `packing_list`: Detailed packing information
- `certificate_of_origin`: Country of origin document
- `insurance_certificate`: Insurance coverage proof

#### Status Codes
- **201 Created**: Documents submitted
- **400 Bad Request**: Missing documents or invalid format
- **404 Not Found**: LC reference not found
- **401 Unauthorized**: Missing or invalid authentication

---

### 4. Request LC Amendment
**POST** `/lc/{bankReference}/amend`

Request an amendment to an existing LC.

#### Path Parameters
- `bankReference` (string): Bank reference from submission response

#### Request Body
```json
{
  "amendments": {
    "type": "extension",
    "details": {
      "newValidityDate": "2024-07-15",
      "reason": "Delayed shipment due to customs"
    }
  }
}
```

#### Amendment Types
- `extension`: Extend LC validity date
- `increase`: Increase LC amount
- `decrease`: Reduce LC amount
- `change_beneficiary`: Change beneficiary details
- `change_terms`: Modify LC terms

#### Response
```json
{
  "success": true,
  "amendmentRef": "AMD-1710723456-XYZ789",
  "bankReference": "LC-1710723456-ABC123DEF",
  "status": "pending",
  "estimatedDays": 3,
  "message": "Amendment request submitted"
}
```

#### Status Codes
- **201 Created**: Amendment request submitted
- **400 Bad Request**: Invalid amendment details
- **404 Not Found**: LC reference not found
- **401 Unauthorized**: Missing or invalid authentication

---

### 5. Get LC Advice
**GET** `/lc/{bankReference}/advice`

Retrieve the full LC advice/notification details.

#### Path Parameters
- `bankReference` (string): Bank reference from submission response

#### Response
```json
{
  "success": true,
  "adviceDetails": {
    "bankReference": "LC-1710723456-ABC123DEF",
    "lcAmount": 50000,
    "currency": "USD",
    "status": "approved",
    "issuingBank": "CHASE001",
    "advisingBank": "ADVISING-BANK-CODE"
  },
  "conditions": [
    "Shipment must be effected on or before the expiry date",
    "Bills of exchange must be drawn on the issuing bank",
    "Insurance certificate in original must be provided",
    "Packing list and commercial invoice required",
    "All documents must be presented within 21 days of shipment"
  ],
  "deadlines": {
    "shipmentDeadline": "2024-06-15T23:59:59Z",
    "documentSubmissionDeadline": "2024-07-06T23:59:59Z"
  }
}
```

#### Status Codes
- **200 OK**: Advice retrieved successfully
- **404 Not Found**: LC reference not found
- **401 Unauthorized**: Missing or invalid authentication

---

### 6. Estimate Bank Charges
**POST** `/charges/estimate`

Calculate estimated charges for an LC.

#### Request Body
```json
{
  "lcAmount": 50000,
  "currency": "USD",
  "bankCode": "CHASE001"
}
```

#### Response
```json
{
  "success": true,
  "breakdown": {
    "lcIssuanceFee": {
      "description": "LC issuance fee",
      "rate": "0.30%",
      "amount": "150.00"
    },
    "amendmentFee": {
      "description": "Amendment fee (flat rate)",
      "amount": "150.00"
    },
    "negotiationFee": {
      "description": "Document negotiation fee",
      "rate": "0.20%",
      "amount": "100.00"
    },
    "swiftCharges": {
      "description": "SWIFT communication charges",
      "amount": "25.00"
    }
  },
  "totalCharges": "425.00",
  "currency": "USD"
}
```

#### Fee Structure
- **LC Issuance Fee**: 0.3% of LC amount
- **Amendment Fee**: $150 (flat rate per amendment)
- **Document Negotiation Fee**: 0.2% of LC amount
- **SWIFT Charges**: $25 (flat rate)

#### Status Codes
- **200 OK**: Charges calculated successfully
- **400 Bad Request**: Invalid input parameters
- **401 Unauthorized**: Missing or invalid authentication

---

## Error Responses

### Standard Error Format
```json
{
  "success": false,
  "error": "Description of the error",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes
- `LC_SUBMISSION_ERROR`: LC application submission failed
- `LC_STATUS_ERROR`: Unable to retrieve LC status
- `DOCUMENT_SUBMISSION_ERROR`: Document submission failed
- `AMENDMENT_REQUEST_ERROR`: Amendment request failed
- `LC_ADVICE_ERROR`: Unable to retrieve LC advice
- `CHARGES_CALCULATION_ERROR`: Charge calculation failed
- `VALIDATION_ERROR`: Request validation failed
- `UNAUTHORIZED`: Authentication failed

---

## Rate Limiting

API requests are subject to rate limiting:
- **General endpoints**: 100 requests per minute per user
- **Auth endpoints**: 10 requests per minute per IP
- **Document endpoints**: 20 requests per minute per user

Rate limit information is included in response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1710727260
```

---

## Webhook Events (Future)

The following events will be sent via webhook when implemented:
- `lc.application.submitted`
- `lc.status.changed`
- `lc.document.submitted`
- `lc.amendment.requested`
- `lc.approved`
- `lc.rejected`

---

## Example Usage

### JavaScript/Fetch
```javascript
const token = localStorage.getItem('authToken');

// Submit LC Application
const lcResponse = await fetch('/api/bank/lc/apply', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    lcAmount: 50000,
    currency: 'USD',
    buyerBankCode: 'CHASE001',
    applicantDetails: { /* ... */ },
    beneficiary: { /* ... */ }
  })
});

const { bankReference } = await lcResponse.json();

// Check Status
const statusResponse = await fetch(`/api/bank/lc/${bankReference}/status`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const statusData = await statusResponse.json();
console.log(statusData.status); // pending, under_review, approved, rejected
```

### cURL
```bash
# Submit LC Application
curl -X POST /api/bank/lc/apply \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lcAmount": 50000,
    "currency": "USD",
    "buyerBankCode": "CHASE001",
    "applicantDetails": {"name": "ABC Trading"},
    "beneficiary": {"name": "XYZ Tiles"}
  }'

# Check Status
curl -X GET /api/bank/lc/{bankReference}/status \
  -H "Authorization: Bearer $TOKEN"

# Estimate Charges
curl -X POST /api/bank/charges/estimate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lcAmount": 50000,
    "currency": "USD",
    "bankCode": "CHASE001"
  }'
```

---

## Implementation Notes

### Current Status
- ✅ Endpoints implemented and documented
- ⚠️ Using simulated bank responses (not real bank APIs)
- ✅ Full authentication integration
- ✅ Error handling and validation
- ✅ Rate limiting ready (via middleware)

### Production Deployment
Before deploying to production:
1. Integrate with actual bank APIs
2. Add request/response logging
3. Implement transaction support
4. Add database persistence
5. Set up webhook notifications
6. Configure bank credentials via environment variables
7. Implement retry logic and timeout handling
8. Add audit logging for compliance

---

**Last Updated**: March 17, 2026
**API Version**: 1.0
**Status**: Production Ready (Simulated)
