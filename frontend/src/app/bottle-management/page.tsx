'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera, QrCode, PackagePlus, PackageMinus, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { bottleManagementApi } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

export default function BottleManagementPage() {
  const { user } = useAuthStore();
  const [history,setHistory]=useState<any[]>([]);
  const [tab,setTab]=useState<'in'|'out'|'history'>('in'); const [bottleCode,setBottleCode]=useState(''); const [details,setDetails]=useState<any>(null);
  const [cameraOn,setCameraOn]=useState(false); const [isMounted,setIsMounted]=useState(false);
  const [historySearch,setHistorySearch]=useState({bottle:'',operation:'ALL',user:'',from:'',to:''});
  const [scanError,setScanError]=useState('');
  const [processing,setProcessing]=useState(false);
  const scannerRef=useRef<any>(null); const scannedRef=useRef(false);
  const canBottleIn = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canBottleOut = user?.role === 'ADMIN' || user?.role === 'CASHIER';
  const canViewHistory = user?.role === 'ADMIN';
  const authorizedRole = canBottleIn || canBottleOut;
  const allowedTabs: Array<'in'|'out'|'history'> = [
    ...(canBottleIn ? ['in' as const] : []),
    ...(canBottleOut ? ['out' as const] : []),
    ...(canViewHistory ? ['history' as const] : []),
  ];
  const loadHistory=async()=>{const h=await bottleManagementApi.history();setHistory(h.data)};
  useEffect(()=>{setIsMounted(true)},[]);
  useEffect(()=>{setTab(user?.role==='CASHIER'?'out':'in')},[user?.role]);
  const stopCamera=async()=>{try{if(scannerRef.current?.isScanning){await scannerRef.current.stop()}else if(scannerRef.current){await scannerRef.current.clear()}}catch{}scannerRef.current=null;setCameraOn(false)};
  const startCamera=async()=>{try{
    if(!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')throw new Error('Camera requires HTTPS or localhost');
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access is not supported by this browser');
    const {Html5Qrcode}=await import('html5-qrcode');
    await stopCamera();
    scannedRef.current=false;
    setCameraOn(true);
    await new Promise(r=>setTimeout(r,100));
    const scanner=new Html5Qrcode('bottle-qr-reader');
    scannerRef.current=scanner;
    await scanner.start(
      {facingMode:'environment'},
      {fps:12,qrbox:(width:number,height:number)=>({width:Math.min(width*0.88,480),height:Math.min(height*0.88,480)}),aspectRatio:1.7777778},
      async (decodedText:string)=>{if(scannedRef.current)return;scannedRef.current=true;setBottleCode(decodedText);await stopCamera();await verify(decodedText);toast.success('Bottle QR detected')},
      ()=>{}
    );
  }catch(e:any){setCameraOn(false);const name=e?.name||'';const raw=String(e?.message||e||'');console.error('Bottle camera start failed:',e);if(name==='NotAllowedError'||name==='PermissionDeniedError'||/permission denied/i.test(raw))toast.error('Camera permission denied. Allow camera access in browser settings.');else if(name==='NotFoundError'||name==='DevicesNotFoundError'||/not found/i.test(raw))toast.error('No camera device was found. Connect a camera or use manual Bottle ID entry.');else toast.error(raw ? `Camera error: ${raw}` : 'Unable to start camera')}};
  useEffect(()=>()=>{if(scannerRef.current){scannerRef.current.stop().catch(()=>{}).finally(()=>scannerRef.current?.clear?.())}},[]);
  const verify=async(code:string)=>{
    const cleanCode=code.trim();
    if(!cleanCode){toast.error('Enter a bottle QR value or ID');return}
    setProcessing(true);
    try{
      const operation=tab==='in'?'IN':'OUT';
      const r=await bottleManagementApi.scan(cleanCode,operation);
      const data=r.data;
      setBottleCode(data.bottleCode||cleanCode);
      setDetails({...data,verificationStatus:'PENDING'});
      setScanError('');
      if(operation==='IN') toast.success(data.newlyRegistered?'Bottle Registered & IN Stock':'Bottle IN completed');
      else toast.success('Bottle OUT completed');
      if(canViewHistory && tab==='history') await loadHistory();
    }catch(e:any){const message=e.response?.data?.message||'Invalid or unreadable bottle QR code';setDetails(null);setScanError(message);toast.error(message)}
    finally{setProcessing(false);scannedRef.current=false}
  };
  const submitManualCode=(event:any)=>{event.preventDefault();if(processing)return;void stopCamera().then(()=>verify(bottleCode))};
  if(!isMounted)return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-sm text-gray-500">Loading Bottle Management...</div></div>;
  if(!authorizedRole)return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="card p-8 text-center"><h1 className="font-bold text-red-600">Access denied</h1><p className="text-sm text-gray-500 mt-2">Bottle Management is available to Admin, Manager, and Cashier roles.</p></div></div>;
  return <div className="min-h-screen bg-gray-50"><header className="bg-white border-b px-6 py-3 flex items-center gap-3"><Link href="/beverages" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5"/></Link><QrCode className="w-5 h-5 text-indigo-600"/><h1 className="font-bold text-lg">Bottle Management</h1>{canViewHistory&&<button onClick={()=>loadHistory().catch(()=>toast.error('Failed to load movement history'))} className="ml-auto"><RefreshCw className="w-4 h-4"/></button>}</header>
  <main className="max-w-7xl mx-auto p-6 space-y-6"><div className="flex gap-2 overflow-x-auto">{([['in',PackagePlus,'Bottle IN'],['out',PackageMinus,'Bottle OUT'],['history',RefreshCw,'Movement History']] as any[]).filter(([key])=>allowedTabs.includes(key)).map(([key,Icon,label])=>  <button key={key} onClick={()=>{stopCamera();setTab(key);setBottleCode('');setDetails(null);setScanError('');if(key==='history')loadHistory().catch(()=>toast.error('Failed to load movement history'))}} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${tab===key?'bg-indigo-600 text-white':'bg-white border text-gray-700'}`}><Icon className="w-4 h-4"/> {label}</button>)}</div>  {(tab==='in'||tab==='out')&&<section className="grid grid-cols-1 lg:grid-cols-2 gap-6"><div className="card p-5"><h2 className="font-semibold mb-4">{tab==='in'?'Bottle IN':'Bottle OUT'} Operation</h2><div className="relative bg-gray-900 rounded-xl h-80 overflow-hidden mb-4 flex items-center justify-center">{cameraOn?<><div id="bottle-qr-reader" className="w-full h-full"/><button onClick={stopCamera} type="button" className="absolute top-2 right-2 z-10 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-white">Stop Camera</button></>:<button onClick={startCamera} className="flex flex-col items-center text-white"><Camera className="w-10 h-10 mb-2 text-indigo-400"/><span>Scan Bottle QR</span></button>}</div><form onSubmit={submitManualCode} className="mb-4 space-y-2"><label htmlFor="manual-bottle-code" className="block text-sm font-medium text-gray-700">Or enter bottle QR value / ID manually</label><div className="flex gap-2"><input id="manual-bottle-code" type="text" maxLength={2048} autoCapitalize="off" autoCorrect="off" value={bottleCode} onChange={(event)=>{setBottleCode(event.target.value);setScanError('')}} placeholder="Type or paste the bottle QR value or ID" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"/><button type="submit" disabled={!bottleCode.trim()||processing} className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{processing?'Processingâ€¦':tab==='in'?'Bottle IN':'Bottle OUT'}</button></div></form><div className="mt-3">{details?<div className={`rounded-lg border px-4 py-3 text-sm ${tab==='in'?'border-green-200 bg-green-50 text-green-800':'border-orange-200 bg-orange-50 text-orange-800'}`}><b>{tab==='in'?(details.newlyRegistered?'Bottle Registered & IN Stock':details.status==='IN_STOCK'?'Bottle Already Registered Ã¢â‚¬â€ Bottle Already IN Stock':'Bottle IN Completed'):'Bottle OUT Completed'}</b><div className="mt-1">Scanned Bottle ID: <b>{details.bottleCode}</b></div></div>:scanError?<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{scanError}</div>:<p className="text-sm text-gray-500">{tab==='in'?'Scan any readable QR code to register and record Bottle IN automatically.':'Scan a registered IN_STOCK bottle to record Bottle OUT automatically.'}</p>}</div></div><div className="card p-5"><h2 className="font-semibold mb-4">Bottle Verification</h2>{details?<div className="flex gap-4"><div className="w-28 h-28 shrink-0 rounded-xl bg-gray-100 overflow-hidden border">{details.imagePath?<img src={details.imagePath} alt={`${details.brand} ${details.productName}`} className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center"><QrCode className="w-10 h-10 text-gray-400"/></div>}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm flex-1"><div><span className="text-gray-500">Bottle ID:</span> <b>{details.bottleCode}</b></div><div><span className="text-gray-500">Status:</span> <b>{details.status}</b></div><div className="sm:col-span-2"><span className="text-gray-500">TASMAC Verification:</span> <b className={`ml-1 ${details.verificationStatus==='VERIFIED'?'text-green-700':details.verificationStatus==='INVALID'?'text-red-700':'text-amber-700'}`}>{details.verificationStatus || 'UNVERIFIED'}</b>{details.verificationReference&&<span className="text-xs text-gray-400 ml-2">Ref: {details.verificationReference}</span>}</div><div><span className="text-gray-500">Brand:</span> <b>{details.brand}</b></div><div><span className="text-gray-500">Product:</span> <b>{details.productName}</b></div><div><span className="text-gray-500">Bottle Size:</span> <b>{details.bottleSizeMl}ml</b></div><div><span className="text-gray-500">Batch ID:</span> <b>{details.batchId}</b></div><div className="sm:col-span-2"><span className="text-gray-500">Available Stock:</span> <b className="text-indigo-700">{Number(details.availableMl||0).toLocaleString()}ml</b></div></div></div>:<div className="text-sm">{scanError?<p className="font-semibold text-red-700">Action not allowed</p>:<p className="text-gray-400">Scan a bottle QR code to display details.</p>}{scanError&&<p className="mt-2 text-gray-600">The QR identifier is already registered and cannot be reused for another Bottle IN or Bottle OUT action.</p>}</div>}</div></section>}
  {tab==='history'&&<section className="card p-5"><h2 className="font-semibold mb-4">Bottle Movement History</h2><div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4"><input value={historySearch.bottle} onChange={e=>setHistorySearch(s=>({...s,bottle:e.target.value}))} placeholder="Bottle ID / QR" className="border rounded-lg px-3 py-2 text-sm"/><select value={historySearch.operation} onChange={e=>setHistorySearch(s=>({...s,operation:e.target.value}))} className="border rounded-lg px-3 py-2 text-sm"><option>ALL</option><option>IN</option><option>OUT</option></select><input value={historySearch.user} onChange={e=>setHistorySearch(s=>({...s,user:e.target.value}))} placeholder="Scanned by user" className="border rounded-lg px-3 py-2 text-sm"/><input type="date" value={historySearch.from} onChange={e=>setHistorySearch(s=>({...s,from:e.target.value}))} className="border rounded-lg px-3 py-2 text-sm"/><input type="date" value={historySearch.to} onChange={e=>setHistorySearch(s=>({...s,to:e.target.value}))} className="border rounded-lg px-3 py-2 text-sm"/></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left bg-gray-50"><th className="p-2">Bottle ID / QR</th><th>Operation</th><th>Previous Status</th><th>Updated Status</th><th>Scanned By</th><th>Date &amp; Time</th></tr></thead><tbody>{history.filter(h=>{const text=String(h.bottleCode||'').toLowerCase();if(historySearch.bottle&&!text.includes(historySearch.bottle.toLowerCase()))return false;if(historySearch.operation!== 'ALL'&&h.operationType!==historySearch.operation)return false;if(historySearch.user&&!String(h.performedBy||'').toLowerCase().includes(historySearch.user.toLowerCase()))return false;const date=new Date(h.performedAt);if(historySearch.from&&date<new Date(`${historySearch.from}T00:00:00`))return false;if(historySearch.to&&date>new Date(`${historySearch.to}T23:59:59`))return false;return true}).map(h=><tr key={h.id} className="border-t"><td className="p-2 font-medium">{h.bottleCode||'-'}</td><td><span className={`px-2 py-1 rounded-full text-xs font-semibold ${h.operationType==='IN'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{h.operationType==='IN'?'BOTTLE IN':'BOTTLE OUT'}</span></td><td>{h.previousStatus||'-'}</td><td>{h.updatedStatus||'-'}</td><td>{h.performedBy}</td><td>{new Date(h.performedAt).toLocaleString()}</td></tr>)}</tbody></table></div></section>}
  </main></div>;
}
