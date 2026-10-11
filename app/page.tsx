'use client';

import { useMemo, useState } from 'react';
import {
  ArrowDownUp, ArrowLeft, ArrowUpLeft, Bath, BedDouble, Bell, Building2,
  Check, ChevronDown, Heart, Home, MapPin, Maximize, Menu, Search, SlidersHorizontal,
  Sparkles, X, Phone, Share2, CarFront, ShieldCheck, Trees, Waves, CalendarDays,
  Grid2X2, List, ChevronLeft, ChevronRight, KeyRound, CircleDollarSign, Compass,
} from 'lucide-react';

type Listing = {
  id: number; title: string; type: string; deal: 'بيع' | 'إيجار'; price: number; currency: string;
  area: string; district: string; address: string; beds: number; baths: number; size: number;
  image: string; gallery: string[]; badge: string; description: string; features: string[];
  agent: string; phone: string; published: string;
};

const listings: Listing[] = [
  {
    id: 101, title: 'شقة بإطلالة مفتوحة على البحر', type: 'شقة', deal: 'بيع', price: 78500, currency: 'USD',
    area: 'خور مكسر', district: 'عدن', address: 'خور مكسر، بالقرب من ساحل أبين، عدن',
    beds: 3, baths: 2, size: 168,
    image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=88',
    gallery: ['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=88','https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=88','https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=88'],
    badge: 'اختيار المحرر', description: 'شقة عصرية بتوزيع عملي ومساحات مضيئة، مع شرفة واسعة وإطلالة مفتوحة. الصور لأغراض العرض ضمن المعاينة، وتحتاج تفاصيل العقار وسعره إلى تأكيد قبل أي قرار.',
    features: ['شرفة واسعة','مصعد في المبنى','موقف سيارة','مطبخ مجهز','إطلالة مفتوحة'], agent: 'مكتب الساحل العقاري', phone: '+967 770 000 101', published: 'منذ يومين',
  },
  {
    id: 102, title: 'فيلا مستقلة بحديقة خاصة', type: 'فيلا', deal: 'بيع', price: 189000, currency: 'USD',
    area: 'عدن الجديدة', district: 'عدن', address: 'عدن الجديدة، منطقة سكنية هادئة، عدن',
    beds: 5, baths: 4, size: 340,
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=88',
    gallery: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=88','https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=88','https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=88'],
    badge: 'مساحة عائلية', description: 'فيلا بتصميم معاصر، غرفة معيشة واسعة وحديقة خارجية خاصة. هذا الإعلان جزء من بيانات المعاينة وليس عرض بيع موثقًا.',
    features: ['حديقة خاصة','موقف سيارتين','غرفة خادمة','مطبخ واسع','مدخل مستقل'], agent: 'مكتب الساحل العقاري', phone: '+967 770 000 102', published: 'منذ ٤ أيام',
  },
  {
    id: 103, title: 'شقة مفروشة للإيجار الشهري', type: 'شقة', deal: 'إيجار', price: 620, currency: 'USD/شهر',
    area: 'المنصورة', district: 'عدن', address: 'المنصورة، بالقرب من الخدمات الرئيسية، عدن',
    beds: 2, baths: 2, size: 118,
    image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=88',
    gallery: ['https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=88','https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=88','https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=88'],
    badge: 'مفروشة', description: 'شقة مفروشة بأثاث معاصر، مناسبة للإقامة الطويلة. الإيجار المذكور تجريبي ولا يشمل بالضرورة الخدمات أو التأمين.',
    features: ['أثاث كامل','تكييف','إنترنت متاح بالمبنى','حراسة','قريبة من الخدمات'], agent: 'مكتب الساحل العقاري', phone: '+967 770 000 103', published: 'اليوم',
  },
  {
    id: 104, title: 'منزل مستقل بطابع هادئ', type: 'منزل', deal: 'بيع', price: 112000, currency: 'USD',
    area: 'كريتر', district: 'عدن', address: 'كريتر، حي سكني، عدن',
    beds: 4, baths: 3, size: 225,
    image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=88',
    gallery: ['https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=88','https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=88','https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=88'],
    badge: 'منزل مستقل', description: 'منزل بتقسيم عملي ومساحات مناسبة للعائلة، مع مساحة خارجية. الموقع والسعر والصور تجريبية وتحتاج تحققًا ميدانيًا.',
    features: ['مدخل مستقل','فناء','مطبخ مستقل','خزان مياه','قريب من السوق'], agent: 'مكتب الساحل العقاري', phone: '+967 770 000 104', published: 'منذ أسبوع',
  },
  {
    id: 105, title: 'مساحة تجارية بواجهة زجاجية', type: 'تجاري', deal: 'إيجار', price: 950, currency: 'USD/شهر',
    area: 'الشيخ عثمان', district: 'عدن', address: 'الشيخ عثمان، شارع تجاري، عدن',
    beds: 0, baths: 1, size: 145,
    image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=88',
    gallery: ['https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=88','https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=88','https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=88'],
    badge: 'تجاري', description: 'مساحة مرنة تصلح لمكتب أو نشاط تجاري خفيف، بواجهة زجاجية ومساحة مفتوحة. الإعلان تجريبي.',
    features: ['واجهة زجاجية','مساحة مفتوحة','حمام','مدخل مباشر','قابل للتقسيم'], agent: 'مكتب الساحل العقاري', phone: '+967 770 000 105', published: 'منذ ٣ أيام',
  },
  {
    id: 106, title: 'شقة عملية قريبة من الخدمات', type: 'شقة', deal: 'إيجار', price: 380, currency: 'USD/شهر',
    area: 'المعلا', district: 'عدن', address: 'المعلا، شارع سكني، عدن',
    beds: 2, baths: 1, size: 92,
    image: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=88',
    gallery: ['https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=88','https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=88','https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=88'],
    badge: 'عملية', description: 'شقة بتصميم بسيط وتوزيع مريح، بالقرب من الخدمات اليومية. السعر والصور والمعلومات أمثلة للمعاينة وليست إعلانًا موثقًا.',
    features: ['قريبة من الخدمات','تهوية جيدة','مطبخ مستقل','مياه متاحة','مدخل مشترك'], agent: 'مكتب الساحل العقاري', phone: '+967 770 000 106', published: 'اليوم',
  },
];

const money = (price: number, currency: string) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price) + ' ' + currency;
type DealFilter = 'الكل' | 'بيع' | 'إيجار';

function ListingCard({ item, saved, onSave, onOpen }: { item: Listing; saved: boolean; onSave: (id:number)=>void; onOpen:(item:Listing)=>void }) {
  return <article className="market-card">
    <button className="market-photo-button" onClick={() => onOpen(item)} aria-label={'عرض تفاصيل ' + item.title}>
      <img className="market-photo" src={item.image} alt={item.title} loading="lazy"/>
      <span className="market-photo-gradient"/>
      <span className="market-tag">{item.deal === 'بيع' ? 'للبيع' : 'للإيجار'}</span>
      <span className="market-image-count"><Grid2X2 size={12}/> {item.gallery.length} صور</span>
    </button>
    <button className={'market-save ' + (saved ? 'saved' : '')} onClick={() => onSave(item.id)} aria-label={saved ? 'إزالة من المحفوظات' : 'حفظ العقار'}><Heart size={17} fill={saved ? 'currentColor' : 'none'}/></button>
    <div className="market-card-body">
      <div className="market-price-line"><strong>{money(item.price,item.currency)}</strong><span>{item.badge}</span></div>
      <button className="market-listing-title" onClick={() => onOpen(item)}>{item.title}</button>
      <p className="market-location"><MapPin size={14}/>{item.area}، {item.district}</p>
      <div className="market-specs"><span><BedDouble size={15}/>{item.beds ? item.beds + ' غرف' : 'مساحة مفتوحة'}</span><span><Bath size={15}/>{item.baths} حمام</span><span><Maximize size={14}/>{item.size} م²</span></div>
      <button className="market-details" onClick={() => onOpen(item)}>عرض العقار بالكامل <ArrowLeft size={15}/></button>
    </div>
  </article>;
}

export default function HomePage() {
  const [deal, setDeal] = useState<DealFilter>('الكل');
  const [kind, setKind] = useState('كل الأنواع');
  const [district, setDistrict] = useState('كل المناطق');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recommended');
  const [saved, setSaved] = useState<number[]>([]);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState('');
  const [contactOpen, setContactOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [onlySaved, setOnlySaved] = useState(false);

  const results = useMemo(() => {
    const found = listings.filter(item =>
      (deal === 'الكل' || item.deal === deal) &&
      (kind === 'كل الأنواع' || item.type === kind) &&
      (district === 'كل المناطق' || item.area === district) &&
      (!onlySaved || saved.includes(item.id)) &&
      (item.title + ' ' + item.area + ' ' + item.type + ' ' + item.address).toLowerCase().includes(search.trim().toLowerCase())
    );
    if (sort === 'low') found.sort((a,b)=>a.price-b.price);
    if (sort === 'high') found.sort((a,b)=>b.price-a.price);
    return found;
  }, [deal, kind, district, onlySaved, saved, search, sort]);

  const showToast = (s:string) => { setToast(s); window.setTimeout(()=>setToast(''),2600); };
  const toggleSave = (id:number) => setSaved(old => old.includes(id) ? old.filter(x=>x!==id) : [...old,id]);
  const openListing = (item:Listing) => { setSelected(item); setPhotoIndex(0); setContactOpen(false); };
  const resetFilters = () => { setDeal('الكل');setKind('كل الأنواع');setDistrict('كل المناطق');setSearch('');setOnlySaved(false);setSort('recommended'); };

  return <main dir="rtl" className="market-shell">
    <div className="market-topline"><div className="market-container market-topline-inner"><span><MapPin size={13}/> عدن، اليمن</span><span>منصة عرض عقاري — تجربة تفاعلية</span><a href="#listings">اكتشف العقارات <ArrowDownUp size={13}/></a></div></div>
    <header className="market-header">
      <div className="market-container market-header-inner">
        <a className="market-brand" href="#top"><span className="market-brand-icon"><Building2 size={21}/></span><span><b>AQAR<span>FLOW</span></b><small>REAL ESTATE MARKETPLACE</small></span></a>
        <nav className={'market-nav '+(mobileMenu?'open':'')}><a href="#listings" onClick={()=>setMobileMenu(false)}>تصفح العقارات</a><a href="#how" onClick={()=>setMobileMenu(false)}>كيف تعمل المنصة</a><button onClick={()=>{setOnlySaved(!onlySaved);document.getElementById('listings')?.scrollIntoView({behavior:'smooth'});setMobileMenu(false)}}><Heart size={15}/> المحفوظات <span className="saved-count">{saved.length}</span></button></nav>
        <div className="market-header-actions"><button className="market-alert-button" onClick={()=>showToast('هذه معاينة محلية؛ لا توجد تنبيهات مرتبطة بحساب')} aria-label="التنبيهات"><Bell size={18}/></button><a href="#listings" className="market-header-cta">تصفح الآن <ArrowLeft size={15}/></a><button className="market-menu-button" onClick={()=>setMobileMenu(!mobileMenu)} aria-label="فتح القائمة">{mobileMenu?<X size={20}/>:<Menu size={20}/>}</button></div>
      </div>
    </header>

    <section id="top" className="market-hero">
      <div className="market-hero-image"><img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2000&q=90" alt="تصميم داخلي سكني معاصر"/><div className="market-hero-overlay"/></div>
      <div className="market-container market-hero-content">
        <div className="market-hero-copy"><span className="market-eyebrow"><span/> اعثر على مكانك القادم</span><h1>العقار المناسب<br/>يبدأ <em>من هنا.</em></h1><p>تصفّح خيارات السكن والاستثمار، قارن التفاصيل، وافتح أي عقار لترى صوره ومواصفاته ومعلومات التواصل في صفحة واحدة.</p><div className="market-hero-trust"><span><Check size={14}/> بحث واضح</span><span><Check size={14}/> تفاصيل قابلة للاستعراض</span><span><Check size={14}/> تصميم يناسب هاتفك</span></div></div>
        <div className="market-search-box">
          <div className="market-search-tabs">{(['الكل','بيع','إيجار'] as DealFilter[]).map(v=><button key={v} className={deal===v?'active':''} onClick={()=>setDeal(v)}>{v==='الكل'?'كل العقارات':v==='بيع'?'شراء عقار':'استئجار عقار'}</button>)}</div>
          <div className="market-search-fields">
            <label className="market-search-input"><Search size={18}/><span><small>ماذا تبحث عنه؟</small><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="اسم العقار أو المنطقة"/></span></label>
            <label className="market-search-select"><MapPin size={18}/><span><small>المنطقة</small><select value={district} onChange={e=>setDistrict(e.target.value)}><option>كل المناطق</option><option>خور مكسر</option><option>عدن الجديدة</option><option>المنصورة</option><option>كريتر</option><option>الشيخ عثمان</option><option>المعلا</option></select></span><ChevronDown size={14}/></label>
            <label className="market-search-select"><Building2 size={18}/><span><small>نوع العقار</small><select value={kind} onChange={e=>setKind(e.target.value)}><option>كل الأنواع</option><option>شقة</option><option>فيلا</option><option>منزل</option><option>تجاري</option></select></span><ChevronDown size={14}/></label>
            <button className="market-search-submit" onClick={()=>document.getElementById('listings')?.scrollIntoView({behavior:'smooth'})}><Search size={17}/> ابحث عن عقار</button>
          </div>
          <div className="market-search-bottom"><span><ShieldCheck size={14}/> بيانات العرض التجريبية — تحقّق قبل التواصل أو الدفع</span><button onClick={resetFilters}>إعادة ضبط البحث</button></div>
        </div>
      </div>
      <div className="market-hero-bottom"><div className="market-container"><span>عقارات متنوعة</span><span className="market-hero-line"/><span>بيع وإيجار</span><span className="market-hero-line"/><span>عدن ومناطقها</span></div></div>
    </section>

    <section id="listings" className="market-listings-section">
      <div className="market-container">
        <div className="market-section-heading"><div><span className="market-section-kicker">اكتشف مساحتك</span><h2>{onlySaved?'العقارات المحفوظة':'عقارات تستحق أن تراها'}<span>.</span></h2><p>صور وتفاصيل ومواصفات — افتح أي بطاقة لعرض العقار بصورة أوسع.</p></div><div className="market-view-tools"><button className="market-filter-toggle" onClick={()=>setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={16}/> الفلاتر <ChevronDown size={14}/></button><label className="market-sort"><ArrowDownUp size={15}/><select value={sort} onChange={e=>setSort(e.target.value)}><option value="recommended">ترتيب مقترح</option><option value="low">السعر: الأقل أولًا</option><option value="high">السعر: الأعلى أولًا</option></select></label></div></div>
        {filtersOpen&&<div className="market-extra-filters"><label>نوع الصفقة<select value={deal} onChange={e=>setDeal(e.target.value as DealFilter)}><option>الكل</option><option>بيع</option><option>إيجار</option></select></label><label>المنطقة<select value={district} onChange={e=>setDistrict(e.target.value)}><option>كل المناطق</option><option>خور مكسر</option><option>عدن الجديدة</option><option>المنصورة</option><option>كريتر</option><option>الشيخ عثمان</option><option>المعلا</option></select></label><label>نوع العقار<select value={kind} onChange={e=>setKind(e.target.value)}><option>كل الأنواع</option><option>شقة</option><option>فيلا</option><option>منزل</option><option>تجاري</option></select></label><button onClick={resetFilters}>مسح جميع الفلاتر</button></div>}
        <div className="market-results-line"><span>يعرض <b>{results.length}</b> من العقارات في المعاينة</span><button onClick={()=>setOnlySaved(!onlySaved)} className={onlySaved?'saved-filter-active':''}><Heart size={14} fill={onlySaved?'currentColor':'none'}/> {onlySaved?'عرض جميع العقارات':'المحفوظات ('+saved.length+')'}</button></div>
        {results.length ? <div className="market-listing-grid">{results.map(item=><ListingCard key={item.id} item={item} saved={saved.includes(item.id)} onSave={toggleSave} onOpen={openListing}/>)}</div> : <div className="market-empty"><Search size={28}/><h3>لم نعثر على عقار بهذه المواصفات</h3><p>غيّر كلمات البحث أو أزل بعض الفلاتر لتظهر نتائج أخرى.</p><button onClick={resetFilters}>عرض كل العقارات</button></div>}
        <div className="market-demo-note"><ShieldCheck size={17}/><p><b>شفافية المعاينة:</b> العقارات والأسعار والعناوين وأرقام التواصل في هذه النسخة بيانات توضيحية وليست إعلانات حقيقية موثقة. الصور صور عقارية مرجعية من Unsplash وليست بالضرورة للعقار المذكور. يلزم ربط مصدر بيانات موثوق قبل النشر للعامة.</p></div>
      </div>
    </section>

    <section id="how" className="market-how"><div className="market-container market-how-inner"><div><span className="market-section-kicker">خطوات واضحة</span><h2>من البحث إلى<br/><em>المعاينة.</em></h2><p>تجربة بسيطة تساعدك على استكشاف العقار قبل التواصل مع المكتب.</p></div><div className="market-how-steps"><article><span>01</span><Search size={21}/><h3>ابحث وحدد</h3><p>اختر البيع أو الإيجار، المنطقة، ونوع العقار.</p></article><article><span>02</span><Grid2X2 size={21}/><h3>قارن التفاصيل</h3><p>شاهد السعر والمساحة والغرف والصور المتاحة.</p></article><article><span>03</span><Phone size={21}/><h3>راجع معلومات التواصل</h3><p>افتح بطاقة العقار واطلب التواصل من داخل المعاينة.</p></article></div></div></section>
    <footer className="market-footer"><div className="market-container market-footer-inner"><a className="market-brand market-brand-light" href="#top"><span className="market-brand-icon"><Building2 size={21}/></span><span><b>AQAR<span>FLOW</span></b><small>REAL ESTATE MARKETPLACE</small></span></a><p>AqarFlow AI · معاينة تفاعلية ببيانات تجريبية</p><a href="#top">العودة للأعلى <ArrowUpLeft size={14}/></a></div></footer>

    {selected && <div className="market-modal-backdrop" onClick={()=>setSelected(null)}>
      <section className="market-detail-modal" role="dialog" aria-modal="true" aria-label={'تفاصيل '+selected.title} onClick={e=>e.stopPropagation()}>
        <div className="market-detail-top"><div><span className="market-detail-kicker">معاينة العقار · رقم {selected.id}</span><h2>{selected.title}</h2><p><MapPin size={15}/>{selected.address}</p></div><button className="market-close" onClick={()=>setSelected(null)} aria-label="إغلاق التفاصيل"><X size={20}/></button></div>
        <div className="market-gallery"><img src={selected.gallery[photoIndex]} alt={selected.title+' — صورة '+(photoIndex+1)}/><span className="market-gallery-counter">{photoIndex+1} / {selected.gallery.length}</span><button className="market-gallery-prev" onClick={()=>setPhotoIndex(i=>(i+selected.gallery.length-1)%selected.gallery.length)} aria-label="الصورة السابقة"><ChevronRight size={20}/></button><button className="market-gallery-next" onClick={()=>setPhotoIndex(i=>(i+1)%selected.gallery.length)} aria-label="الصورة التالية"><ChevronLeft size={20}/></button><div className="market-gallery-thumbs">{selected.gallery.map((src,i)=><button key={src} className={i===photoIndex?'active':''} onClick={()=>setPhotoIndex(i)}><img src={src} alt={'مصغرة '+(i+1)}/></button>)}</div></div>
        <div className="market-detail-content"><div className="market-detail-main"><div className="market-detail-price"><span>{selected.deal==='بيع'?'سعر البيع':'الإيجار الشهري'}</span><strong>{money(selected.price,selected.currency)}</strong><span className="market-detail-type">{selected.deal==='بيع'?'للبيع':'للإيجار'} · {selected.type}</span></div><div className="market-detail-specs"><div><BedDouble size={18}/><b>{selected.beds||'—'}</b><span>غرف نوم</span></div><div><Bath size={18}/><b>{selected.baths}</b><span>حمامات</span></div><div><Maximize size={18}/><b>{selected.size}</b><span>متر مربع</span></div><div><Compass size={18}/><b>{selected.area}</b><span>المنطقة</span></div></div><div className="market-detail-section"><h3>عن العقار</h3><p>{selected.description}</p></div><div className="market-detail-section"><h3>المزايا والتفاصيل</h3><div className="market-features">{selected.features.map(feature=><span key={feature}><Check size={14}/>{feature}</span>)}</div></div><div className="market-detail-section"><h3>الموقع</h3><div className="market-location-card"><div className="market-map-art"><div className="map-road road-one"/><div className="map-road road-two"/><div className="map-block block-one"/><div className="map-block block-two"/><div className="map-block block-three"/><div className="map-block block-four"/><span className="map-pin"><MapPin size={19}/></span><span className="map-caption">موقع توضيحي</span></div><p><MapPin size={15}/>{selected.address}</p><small>الخريطة توضيحية وليست موقعًا جغرافيًا دقيقًا.</small></div></div></div>
          <aside className="market-detail-sidebar"><div className="market-agent-card"><span className="market-agent-avatar"><Building2 size={21}/></span><div><b>{selected.agent}</b><span>معلومات مكتب تجريبية</span></div><span className="market-agent-verified"><ShieldCheck size={15}/> تجريبي</span><p>تمت إضافة هذا المكتب لشرح شكل معلومات التواصل داخل صفحة العقار.</p><button className="market-contact-main" onClick={()=>setContactOpen(!contactOpen)}><Phone size={16}/>{contactOpen?'إخفاء نموذج التواصل':'اطلب التواصل'}</button>{contactOpen&&<form className="market-contact-form" onSubmit={e=>{e.preventDefault();showToast('لم يتم إرسال الطلب؛ نموذج المعاينة لا يتصل بخدمة خارجية');setContactOpen(false)}}><label>اسمك<input required value={contactName} onChange={e=>setContactName(e.target.value)} placeholder="الاسم الكامل"/></label><label>رقم الهاتف<input required value={contactPhone} onChange={e=>setContactPhone(e.target.value)} placeholder="رقم للتواصل" inputMode="tel"/></label><label>رسالتك<textarea value={contactMessage} onChange={e=>setContactMessage(e.target.value)} placeholder="أرغب في معرفة المزيد عن العقار"/></label><button type="submit">إرسال طلب تجريبي</button><small>لن تُرسل البيانات إلى أي جهة.</small></form>}<button className="market-contact-secondary" onClick={()=>{toggleSave(selected.id);showToast(saved.includes(selected.id)?'أزيل العقار من المحفوظات':'حُفظ العقار في هذه المعاينة')}}><Heart size={16} fill={saved.includes(selected.id)?'currentColor':'none'}/>{saved.includes(selected.id)?'محفوظ لديك':'احفظ العقار'}</button><button className="market-contact-secondary" onClick={()=>showToast('مشاركة الرابط غير متصلة في نسخة المعاينة')}><Share2 size={16}/> مشاركة العقار</button><div className="market-agent-phone"><Phone size={14}/><span>{selected.phone}</span></div><small className="market-demo-warning">رقم تجريبي لا تتصل به. السعر والصور والتفاصيل تحتاج تحققًا.</small></div><div className="market-safe-card"><ShieldCheck size={18}/><b>قبل اتخاذ القرار</b><p>تحقق من ملكية العقار، وموقعه، والسعر، وهوية الوسيط بنفسك. بيانات هذه المعاينة غير موثقة.</p></div></aside></div>
        <div className="market-detail-bottom"><span><CalendarDays size={14}/> نُشر في البيانات التجريبية: {selected.published}</span><button onClick={()=>setSelected(null)}>العودة إلى النتائج <ArrowLeft size={15}/></button></div>
      </section>
    </div>}
    {toast&&<div className="market-toast" role="status"><Check size={16}/>{toast}</div>}
  </main>;
}
