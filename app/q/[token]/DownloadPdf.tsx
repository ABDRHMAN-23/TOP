'use client';

import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#0f172a', fontFamily: 'Helvetica' },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  brand: { fontSize: 20, fontWeight: 700, color: '#2563eb' },
  meta: { fontSize: 9, color: '#64748b', marginTop: 4 },
  title: { fontSize: 24, fontWeight: 700, marginTop: 24 },
  client: { marginTop: 18, padding: 12, backgroundColor: '#f8fafc', borderRadius: 6 },
  clientTitle: { fontSize: 9, color: '#64748b', marginBottom: 4 },
  table: { marginTop: 22, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6 },
  row: { flexDirection: 'row', padding: 9, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  header: { backgroundColor: '#f8fafc', fontWeight: 700 },
  desc: { flex: 1 },
  qty: { width: 70 },
  amount: { width: 90, textAlign: 'right' },
  total: { marginTop: 18, marginLeft: 'auto', width: 210 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  grand: { borderTopWidth: 1, borderTopColor: '#0f172a', paddingTop: 8, marginTop: 8, fontSize: 15, fontWeight: 700 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, color: '#94a3b8', fontSize: 8, textAlign: 'center' }
});

export default function DownloadPdf({ quote, business }: { quote: any; business: any }) {
  const items = Array.isArray(quote.items) ? quote.items : [];
  const name = (quote.quote_number || 'quote') + '.pdf';
  const doc = (
    <Document title={quote.quote_number} author={business?.business_name || 'VoiceQuote'}>
      <Page size="A4" style={styles.page}>
        <View style={styles.top}>
          <View><Text style={styles.brand}>{business?.business_name || 'VoiceQuote'}</Text><Text style={styles.meta}>{business?.email || ''}</Text><Text style={styles.meta}>{business?.phone || ''}</Text></View>
          <View><Text style={styles.meta}>QUOTE</Text><Text style={{fontSize:12,fontWeight:700}}>{quote.quote_number}</Text><Text style={styles.meta}>{new Date(quote.created_at).toLocaleDateString()}</Text></View>
        </View>
        <Text style={styles.title}>Professional Quote</Text>
        <View style={styles.client}><Text style={styles.clientTitle}>PREPARED FOR</Text><Text>{quote.client_name || 'Client'}</Text>{quote.client_address ? <Text style={styles.meta}>{quote.client_address}</Text> : null}</View>
        <View style={styles.table}>
          <View style={[styles.row, styles.header]}><Text style={styles.desc}>Description</Text><Text style={styles.qty}>Qty</Text><Text style={styles.amount}>Amount</Text></View>
          {items.map((item:any,i:number)=><View key={i} style={styles.row}><Text style={styles.desc}>{item.description || 'Item'}</Text><Text style={styles.qty}>{item.quantity || 0} {item.unit || ''}</Text><Text style={styles.amount}>{quote.currency} {(Number(item.quantity||0)*Number(item.price||0)).toFixed(2)}</Text></View>)}
        </View>
        <View style={styles.total}>
          <View style={styles.totalRow}><Text>Subtotal</Text><Text>{quote.currency} {Number(quote.subtotal).toFixed(2)}</Text></View>
          {Number(quote.discount)>0?<View style={styles.totalRow}><Text>Discount</Text><Text>-{quote.currency} {Number(quote.discount).toFixed(2)}</Text></View>:null}
          {Number(quote.vat_amount)>0?<View style={styles.totalRow}><Text>VAT ({quote.vat_rate}%)</Text><Text>{quote.currency} {Number(quote.vat_amount).toFixed(2)}</Text></View>:null}
          <View style={[styles.totalRow, styles.grand]}><Text>Total</Text><Text>{quote.currency} {Number(quote.total).toFixed(2)}</Text></View>
        </View>
        <Text style={styles.footer}>Generated with VoiceQuote</Text>
      </Page>
    </Document>
  );
  return <PDFDownloadLink document={doc} fileName={name} className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">{({loading}) => loading ? 'Preparing PDF…' : 'Download PDF'}</PDFDownloadLink>;
}
