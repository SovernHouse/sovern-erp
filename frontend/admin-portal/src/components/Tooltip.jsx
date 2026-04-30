/**
 * Tooltip.jsx
 *
 * Lightweight hover tooltip with four placement options.
 * Renders inline — no portal required for ERP use cases.
 *
 * Usage:
 *   import { Tooltip, FieldTip } from './Tooltip'
 *
 *   // Wrap any element
 *   <Tooltip content="Approved by client. Cannot be edited." placement="top">
 *     <StatusBadge status="approved" />
 *   </Tooltip>
 *
 *   // Label + help icon shorthand (common for form fields)
 *   <FieldTip label="Payment Terms" tip="Net 30 means payment is due 30 days after invoice date." />
 */

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'

const PLACEMENT = {
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left:   'right-full top-1/2 -translate-y-1/2 mr-2',
  right:  'left-full top-1/2 -translate-y-1/2 ml-2',
}

const ARROW = {
  top:    'top-full left-1/2 -translate-x-1/2 border-t-gray-800 border-l-transparent border-r-transparent border-b-transparent',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800 border-l-transparent border-r-transparent border-t-transparent',
  left:   'left-full top-1/2 -translate-y-1/2 border-l-gray-800 border-t-transparent border-b-transparent border-r-transparent',
  right:  'right-full top-1/2 -translate-y-1/2 border-r-gray-800 border-t-transparent border-b-transparent border-l-transparent',
}

/**
 * @param {object}  props
 * @param {string|ReactNode} props.content    Tooltip text or JSX
 * @param {'top'|'bottom'|'left'|'right'} [props.placement='top']
 * @param {string}  [props.maxWidth='280px']  CSS max-width for the bubble
 * @param {boolean} [props.disabled]          Pass true to suppress the tooltip
 * @param {ReactNode} props.children
 */
export function Tooltip({ content, placement = 'top', maxWidth = '280px', disabled = false, children }) {
  const [visible, setVisible] = useState(false)

  if (!content || disabled) return children

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          style={{ maxWidth }}
          className={`
            absolute z-50 ${PLACEMENT[placement]}
            bg-gray-800 text-white text-xs leading-relaxed
            rounded-md px-3 py-2 shadow-lg pointer-events-none
            whitespace-normal text-left
          `}
        >
          {content}
          <span className={`absolute border-4 ${ARROW[placement]}`} />
        </span>
      )}
    </span>
  )
}

/**
 * FieldTip — label with an inline (?) help icon.
 * Designed for form field labels.
 *
 * @param {object} props
 * @param {string} props.label  The visible label text
 * @param {string} props.tip    Tooltip content
 * @param {boolean} [props.required]
 * @param {string}  [props.placement]
 */
export function FieldTip({ label, tip, required = false, placement = 'top' }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</span>
      <Tooltip content={tip} placement={placement}>
        <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" aria-label={`Help: ${label}`} />
      </Tooltip>
    </span>
  )
}

/**
 * StatusTip — wraps a status badge string with a tooltip explaining what it means.
 * Import STATUS_TIPS from tooltipContent.js and spread it.
 *
 * <StatusTip status="in_production" modelName="SalesOrder">
 *   <StatusBadge status="in_production" />
 * </StatusTip>
 */
export function StatusTip({ status, modelName, children }) {
  const key = modelName ? `${modelName}.${status}` : status
  const content = STATUS_DESCRIPTIONS[key] || STATUS_DESCRIPTIONS[status] || null
  return (
    <Tooltip content={content} placement="top">
      {children}
    </Tooltip>
  )
}

// ─── Inline status descriptions (fallback — prefer importing from tooltipContent.js) ──

const STATUS_DESCRIPTIONS = {
  // SalesOrder
  'SalesOrder.confirmed':     'Order confirmed with the buyer. Waiting for production to begin.',
  'SalesOrder.in_production': 'Goods are actively being manufactured at the factory.',
  'SalesOrder.ready':         'Production complete. Goods are ready for shipment.',
  'SalesOrder.shipped':       'Goods have left the factory and are in transit.',
  'SalesOrder.in_transit':    'Shipment is en route to the destination port.',
  'SalesOrder.delivered':     'Goods have arrived at the buyer\'s destination.',
  'SalesOrder.completed':     'Order fully complete. Payment confirmed and documents closed.',
  'SalesOrder.cancelled':     'Order cancelled. No further actions possible.',

  // ProformaInvoice
  'ProformaInvoice.draft':     'Draft PI — not yet sent to the buyer.',
  'ProformaInvoice.sent':      'PI has been sent to the buyer for review.',
  'ProformaInvoice.confirmed': 'Buyer has confirmed the PI. Ready to convert to Sales Order.',
  'ProformaInvoice.cancelled': 'PI cancelled.',

  // Invoice
  'Invoice.draft':          'Invoice drafted but not yet sent.',
  'Invoice.sent':           'Invoice sent to the buyer. Awaiting payment.',
  'Invoice.partially_paid': 'Partial payment received. Balance outstanding.',
  'Invoice.paid':           'Invoice fully paid.',
  'Invoice.overdue':        'Payment due date has passed. Follow up required.',
  'Invoice.cancelled':      'Invoice cancelled.',

  // Shipment
  'Shipment.booked':     'Cargo space has been booked with the carrier.',
  'Shipment.loaded':     'Goods have been loaded onto the vessel or vehicle.',
  'Shipment.in_transit': 'Shipment is en route.',
  'Shipment.at_port':    'Shipment has arrived at the destination port.',
  'Shipment.customs':    'Shipment is being processed by customs.',
  'Shipment.delivered':  'Goods have been delivered to the final destination.',

  // PurchaseOrder
  'PurchaseOrder.draft':         'PO drafted — not yet sent to the factory.',
  'PurchaseOrder.sent':          'PO sent to the factory awaiting confirmation.',
  'PurchaseOrder.confirmed':     'Factory has confirmed the order.',
  'PurchaseOrder.in_production': 'Factory is actively producing the goods.',
  'PurchaseOrder.ready':         'Production complete. Ready to ship.',
  'PurchaseOrder.shipped':       'Goods shipped from the factory.',
  'PurchaseOrder.received':      'Goods received at our warehouse.',
  'PurchaseOrder.completed':     'PO fully closed.',
  'PurchaseOrder.cancelled':     'PO cancelled.',

  // DocumentApproval
  'pending':  'Waiting for the client to review and approve.',
  'approved': 'Client has approved this document.',
  'rejected': 'Client has rejected this document. Check the rejection reason.',
  'expired':  'Approval link has expired. Generate a new one if needed.',
}

export { STATUS_DESCRIPTIONS }
export default Tooltip
