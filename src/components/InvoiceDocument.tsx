import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { Invoice } from '../services/invoiceService';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 11, padding: 40, color: '#333' },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#1a202c', paddingBottom: 10, marginBottom: 30 },
  companyName: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#1a202c' },
  invoiceTitle: { fontSize: 14, color: '#a0aec0' },
  invoiceInfoContainer: { textAlign: 'right' },
  billingAddress: { marginBottom: 40 },
  billTo: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 5 },
  table: { display: 'table', width: 'auto', borderStyle: 'solid', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 3 },
  tableRow: { flexDirection: 'row', borderBottomColor: '#e2e8f0', borderBottomWidth: 1 },
  tableHeader: { backgroundColor: '#f7fafc', fontFamily: 'Helvetica-Bold' },
  tableCol: { padding: 8 },
  tableCell: { padding: 8 },
  textRight: { textAlign: 'right' },
  totalsContainer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 },
  totalsTable: { width: '40%' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  grandTotalRow: { borderTopWidth: 1, borderTopColor: '#333', marginTop: 5, paddingTop: 5, fontFamily: 'Helvetica-Bold' },
});

interface InvoiceDocumentProps {
  invoice: Invoice;
}

const InvoiceDocument: React.FC<InvoiceDocumentProps> = ({ invoice }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* --- HEADER & BILLING (Unchanged) --- */}
      <View style={styles.header}>
        {/* ... */}
      </View>
      <View style={styles.billingAddress}>
        {/* ... */}
      </View>

      {/* --- ITEMS TABLE (UPDATED) --- */}
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCol, { width: '40%' }]}>Item Description</Text>
          <Text style={[styles.tableCol, styles.textRight, { width: '10%' }]}>Qty</Text>
          <Text style={[styles.tableCol, styles.textRight, { width: '15%' }]}>Rate</Text>
          <Text style={[styles.tableCol, styles.textRight, { width: '15%' }]}>Tax</Text>
          <Text style={[styles.tableCol, styles.textRight, { width: '20%' }]}>Amount</Text>
        </View>
        {invoice.items.map(item => (
          <View style={styles.tableRow} key={item.id}>
            <Text style={[styles.tableCell, { width: '40%' }]}>{item.product}</Text>
            <Text style={[styles.tableCell, styles.textRight, { width: '10%' }]}>{item.quantity}</Text>
            <Text style={[styles.tableCell, styles.textRight, { width: '15%' }]}>${Number(item.itemRate).toFixed(2)}</Text>
            {/* Added Tax Column */}
            <Text style={[styles.tableCell, styles.textRight, { width: '15%' }]}>${Number(item.taxAmount || 0).toFixed(2)}</Text>
            <Text style={[styles.tableCell, styles.textRight, { width: '20%' }]}>${Number(item.lineTotal).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* --- TOTALS SECTION (UPDATED LABELS) --- */}
      <View style={styles.totalsContainer}>
        <View style={styles.totalsTable}>
          <View style={styles.totalsRow}>
            <Text>Subtotal (Pre-tax)</Text>
            <Text>${Number(invoice.subtotal).toFixed(2)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Discount</Text>
            <Text>- ${Number(invoice.discountAmount).toFixed(2)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Total Tax (VAT)</Text>
            <Text>${Number(invoice.vatAmount).toFixed(2)}</Text>
          </View>
          <View style={[styles.totalsRow, styles.grandTotalRow]}>
            <Text>Grand Total</Text>
            <Text>${Number(invoice.grandTotal).toFixed(2)}</Text>
          </View>
        </View>
      </View>
      
       {invoice.notes && (
          <View style={styles.notes}>
            <Text style={{fontFamily: 'Helvetica-Bold'}}>Notes:</Text>
            <Text>{invoice.notes}</Text>
          </View>
      )}
    </Page>
  </Document>
);

export default InvoiceDocument;
