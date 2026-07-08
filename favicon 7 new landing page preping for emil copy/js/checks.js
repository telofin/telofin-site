// ══════════════════════════════════════════
// CHECK PRINTING
// ══════════════════════════════════════════
// Field positions inside a single check strip, inches from the top-left of the strip.
// Shared across all three page formats below (voucher2/voucher1/standard3) — what
// differs between formats is the strip's height and how many memo stubs follow it,
// not where PAY TO / amount / date sit relative to the top of the check itself.
// Based on the common Deluxe/Intuit-style voucher check convention most check-stock
// vendors follow. Every printer/stock combination still drifts a little, which is what
// the calibration offsets (bankAcct.checkOffsetX/Y) correct for — see printCheckAlignmentTest().
var CHECK_FIELDS={
  date:       {top:0.62, left:6.5,  width:1.7},
  payee:      {top:1.35, left:1.0,  width:5.4},
  amountBox:  {top:1.35, left:6.85, width:1.35},
  amountWords:{top:1.68, left:0.5,  width:7.3},
  address:    {top:2.0,  left:0.7,  width:3.2},
  memo:       {top:2.65, left:0.5,  width:3.0},
  signature:  {top:2.65, left:5.3,  width:2.7}
};
// The three physical check-page formats "What does your check page look like?" (the
// bank-account modal, renders.js) asks about. checkHeight/stubHeight are inches.
var CHECK_FORMATS={
  voucher2: {label:'1 check + 2 vouchers', checkHeight:3.5,   stubCount:2, stubHeight:3.75},
  voucher1: {label:'1 check + 1 voucher',  checkHeight:3.5,   stubCount:1, stubHeight:7.5},
  standard3:{label:'3 checks, no vouchers',checkHeight:3.667, stubCount:0, stubHeight:0}
};
function _checkFormat(bankAcct){
  return CHECK_FORMATS[bankAcct&&bankAcct.checkFormat]||CHECK_FORMATS.voucher2;
}

function _fmtCheckDate(d){
  var dt=typeof parseDate==='function'?parseDate(d):null;
  if(!dt)return d||'';
  return (dt.getMonth()+1)+'/'+dt.getDate()+'/'+dt.getFullYear();
}
function _fmtCheckAmount(n){
  return '$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function _checkFieldPos(p,offX,offY){
  return 'position:absolute;top:'+(p.top+offY)+'in;left:'+(p.left+offX)+'in;width:'+p.width+'in;';
}
function _checkStubHtml(payee,date,amount,memo,checkNum){
  return '<div class="check-stub">'
    +'<div class="stub-row"><strong>'+escHtml(payee||'')+'</strong><span>'+_fmtCheckAmount(amount)+'</span></div>'
    +'<div class="stub-row"><span>'+escHtml(_fmtCheckDate(date))+'</span><span>Check #'+escHtml(checkNum||'')+'</span></div>'
    +(memo?'<div class="stub-memo">'+escHtml(memo)+'</div>':'')
    +'</div>';
}
function _checkStyles(checkHeight){
  return '<style>@page{size:letter;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#000}'
    +'.check-page{width:8.5in}'
    +'.check-top{position:relative;width:8.5in;height:'+(checkHeight||3.5)+'in;border-bottom:1px dashed #ccc}'
    +'.check-stubs{width:8.5in}'
    +'.check-stub{padding:.3in .5in;border-bottom:1px dashed #ccc;font-size:11px}'
    +'.stub-row{display:flex;justify-content:space-between;margin-bottom:4px}'
    +'.stub-memo{color:#555;font-size:10px}'
    +'.cal-mark{position:absolute;font-size:8px;color:#c0392b;white-space:nowrap}'
    +'.cal-cross{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px}'
    +'.cal-cross::before,.cal-cross::after{content:"";position:absolute;background:#c0392b}'
    +'.cal-cross::before{left:5px;top:0;width:1px;height:10px}'
    +'.cal-cross::after{top:5px;left:0;width:10px;height:1px}'
    +'.ruler-top{position:absolute;top:0;left:0;width:8.5in;height:.2in;font-size:7px;color:#999}'
    +'.ruler-left{position:absolute;top:0;left:0;height:11in;width:.2in;font-size:7px;color:#999}'
    +'@media print{.no-print{display:none}.check-top{border-bottom:none}.check-stub{border-bottom:none}}'
    +'</style>';
}
function _checkPrintBar(label){
  return '<div class="no-print" style="padding:16px;display:flex;gap:10px">'
    +'<button onclick="window.print()" style="padding:8px 20px;background:#1a1814;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">'+(label||'Print check')+'</button>'
    +'<button onclick="window.close()" style="padding:8px 18px;background:#fff;color:#1a1814;border:1px solid #e8e6e0;border-radius:6px;cursor:pointer;font-size:13px">&larr; Close</button>'
    +'</div>';
}

// _checkPageHtml(bankAcct, opts, pageBreak): builds one check-page block (the check strip
// plus whatever stubs the format calls for). opts: {payee, address, amount, date, memo,
// checkNum}. pageBreak forces a page break after this block, for batch printing multiple
// checks in one print job. Shared by printCheck() (single) and printChecksBatch().
// Note: for the "3 checks, no vouchers" format this always prints into the top check
// position on the page — printing into the 2nd/3rd slot of a partially-used sheet isn't
// supported yet, including in the batch case (each check in a batch still consumes its own
// full physical page).
function _checkPageHtml(bankAcct,opts,pageBreak){
  var fmt=_checkFormat(bankAcct);
  var L=CHECK_FIELDS;
  var offX=Number(bankAcct&&bankAcct.checkOffsetX||0);
  var offY=Number(bankAcct&&bankAcct.checkOffsetY||0);
  function pos(p){return _checkFieldPos(p,offX,offY);}
  var amountWordsStr=numToWords(opts.amount)+' Dollars';
  var stubsHtml='';
  for(var i=0;i<fmt.stubCount;i++)stubsHtml+=_checkStubHtml(opts.payee,opts.date,opts.amount,opts.memo,opts.checkNum);
  return '<div class="check-page"'+(pageBreak?' style="page-break-after:always"':'')+'>'
    +'<div class="check-top">'
    +'<div style="'+pos(L.date)+'font-size:11px">'+escHtml(_fmtCheckDate(opts.date))+'</div>'
    +'<div style="'+pos(L.payee)+'font-size:12px;border-bottom:1px solid #000;padding-bottom:2px"><span style="font-size:9px;color:#555">PAY TO THE ORDER OF&nbsp;&nbsp;</span>'+escHtml(opts.payee||'')+'</div>'
    +'<div style="'+pos(L.amountBox)+'font-size:12px;border:1px solid #000;padding:2px 6px;text-align:right">'+_fmtCheckAmount(opts.amount)+'</div>'
    +'<div style="'+pos(L.amountWords)+'font-size:11px;border-bottom:1px solid #000;padding-bottom:2px">'+escHtml(amountWordsStr)+'</div>'
    +(opts.address?'<div style="'+pos(L.address)+'font-size:10px;white-space:pre-line">'+escHtml(opts.address)+'</div>':'')
    +'<div style="'+pos(L.memo)+'font-size:10px"><span style="color:#555">MEMO&nbsp;</span>'+escHtml(opts.memo||'')+'</div>'
    +'<div style="'+pos(L.signature)+'border-bottom:1px solid #000;height:1px"></div>'
    +'</div>'
    +(stubsHtml?'<div class="check-stubs">'+stubsHtml+'</div>':'')
    +'</div>';
}
// printCheck(c, bankAcct, opts): opens a print-ready window for a single check, using
// whichever page format bankAcct.checkFormat is set to (defaults to 1 check + 2 vouchers).
// opts: {payee, address, amount, date, memo, checkNum}.
function printCheck(c,bankAcct,opts){
  var fmt=_checkFormat(bankAcct);
  var body=_checkPageHtml(bankAcct,opts,false);
  var w=window.open('','_blank');
  if(!w){alert('Please allow pop-ups to print a check.');return;}
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Check #'+escHtml(opts.checkNum)+' — '+escHtml(opts.payee||'')+'</title>'+_checkStyles(fmt.checkHeight)+'</head><body>');
  w.document.write(body);
  w.document.write(_checkPrintBar('Print check'));
  w.document.write('</body></html>');
  w.document.close();
}
// printChecksBatch(c, bankAcct, checksArray): same as printCheck() but for a whole batch —
// one print window, one check-page per entry in checksArray (each {payee, address, amount,
// date, memo, checkNum}), in order, with a page break between them so they print as one job.
function printChecksBatch(c,bankAcct,checksArray){
  if(!checksArray||!checksArray.length)return;
  var fmt=_checkFormat(bankAcct);
  var body=checksArray.map(function(opts,i){return _checkPageHtml(bankAcct,opts,i<checksArray.length-1);}).join('');
  var w=window.open('','_blank');
  if(!w){alert('Please allow pop-ups to print checks.');return;}
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+checksArray.length+' checks</title>'+_checkStyles(fmt.checkHeight)+'</head><body>');
  w.document.write(body);
  w.document.write(_checkPrintBar('Print '+checksArray.length+' checks'));
  w.document.write('</body></html>');
  w.document.close();
}

// printCheckAlignmentTest(offX, offY, checkFormat): prints the same field positions as a
// real check, but as labeled crosshairs plus inch rulers along the top and left edges,
// instead of real check data. Hold this against your actual blank check stock (or up to
// a light) to measure how far off each mark is, then nudge the offset and reprint until
// the crosshairs line up with the pre-printed boxes.
function printCheckAlignmentTest(offX,offY,checkFormat){
  var fmt=CHECK_FORMATS[checkFormat]||CHECK_FORMATS.voucher2;
  var L=CHECK_FIELDS;
  offX=Number(offX||0);offY=Number(offY||0);
  function markAt(p,label){
    return '<div class="cal-cross" style="top:'+(p.top+offY)+'in;left:'+(p.left+offX)+'in"></div>'
      +'<div class="cal-mark" style="top:'+(p.top+offY+0.12)+'in;left:'+(p.left+offX)+'in">'+escHtml(label)+'</div>';
  }
  var ruler='<div class="ruler-top">'+[0,1,2,3,4,5,6,7,8].map(function(i){return'<span style="position:absolute;left:'+i+'in">'+i+'"</span>';}).join('')+'</div>'
    +'<div class="ruler-left">'+[0,1,2,3].map(function(i){return'<span style="position:absolute;top:'+i+'in">'+i+'"</span>';}).join('')+'</div>';
  var body='<div class="check-page"><div class="check-top">'
    +ruler
    +markAt(L.date,'Date')
    +markAt(L.payee,'Payee')
    +markAt(L.amountBox,'Amount box')
    +markAt(L.amountWords,'Amount in words')
    +markAt(L.address,'Address')
    +markAt(L.memo,'Memo')
    +markAt(L.signature,'Signature')
    +'</div></div>';
  var w=window.open('','_blank');
  if(!w){alert('Please allow pop-ups to print a test page.');return;}
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Check alignment test</title>'+_checkStyles(fmt.checkHeight)+'</head><body>');
  w.document.write(body);
  w.document.write(_checkPrintBar('Print test page'));
  w.document.write('</body></html>');
  w.document.close();
}
