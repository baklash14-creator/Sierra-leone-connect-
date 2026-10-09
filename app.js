/* SL Connect - app logic (needs config.js loaded first) */
/* =========================================== */
const PAGES=[["home","Home"],["market","Marketplace"],["account","My Account"],["about","About"],["contact","Contact us"]];
const TABS=[["all","All"],["service","Workers & Services"],["job","Jobs Wanted"],["rent","Houses for Rent"],["land","Land for Sale"]];
const LABEL={service:"Worker",job:"Job needed",rent:"For rent",land:"For sale"};
const TAKEN={service:"Busy",job:"Filled",rent:"Rented",land:"Sold"};
const ICON={service:"🛠️",job:"💼",rent:"🏠",land:"🌍"};
const K={posts:"slconnect_posts_v3",users:"slconnect_users_v2",sess:"slconnect_session_v2",theme:"slconnect_theme"};
const seed=[
 {id:"s1",type:"service",title:"Electrician",cat:"Electrical",loc:"Freetown",price:"Le 150 per day",phone:"+23276000001",desc:"House wiring, repairs and solar installation. 8 years experience.",owner:"demo",by:"Demo",status:"open",images:[]},
 {id:"s2",type:"service",title:"Tailor & Fashion Designer",cat:"Tailoring",loc:"Bo",price:"Le 80 per outfit",phone:"+23277000002",desc:"Traditional and modern clothes, fast delivery.",owner:"demo",by:"Demo",status:"open",images:[]},
 {id:"j1",type:"job",title:"Driver needed",cat:"Driving",loc:"Lumley, Freetown",price:"Le 3,000 per month",phone:"+23278000003",desc:"Company needs a driver with a valid licence.",owner:"demo",by:"Demo",status:"open",images:[]},
 {id:"r1",type:"rent",title:"3-bedroom house",cat:"",loc:"Hill Station",price:"Le 6,000 per month",phone:"+23279000004",desc:"Water, fence and parking space.",owner:"demo",by:"Demo",status:"open",images:[]},
 {id:"l1",type:"land",title:"2 plots of land",cat:"",loc:"Waterloo",price:"Le 90,000",phone:"+23276000005",desc:"Clear documents, near the main road.",owner:"demo",by:"Demo",status:"open",images:[]}
];
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const load=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
const store=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const norm=p=>String(p||"").replace(/[^\d+]/g,"");
let posts=CLOUD?[]:load(K.posts,seed),users=load(K.users,[]),user=null,tab="all",acTab="mine",mode="in",page="home",cur=null,imgs=[],tok=0;
if(!Array.isArray(users))users=[];
{const s=load(K.sess,null);user=users.find(u=>u.id===s)||null}

function toast(m){const t=$("toast");t.textContent=m;t.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("show"),2400)}
async function hash(s){try{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("slc:"+s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}catch(e){let h=0;for(const c of"slc:"+s)h=(h*31+c.charCodeAt(0))|0;return"x"+h}}

/* ---- theme ---- */
function applyTheme(t){document.documentElement.dataset.theme=t;store(K.theme,t);$("themeBtn").textContent=t==="dark"?"☀️":"🌙"}
applyTheme(load(K.theme,matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"));
$("themeBtn").onclick=()=>{const b=$("themeBtn");b.classList.remove("spin");void b.offsetWidth;b.classList.add("spin");applyTheme(document.documentElement.dataset.theme==="dark"?"light":"dark")};

/* ---- scroll reveal, ripple, rotating words ---- */
const io="IntersectionObserver" in window?new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting){en.target.classList.add("in");io.unobserve(en.target)}}),{threshold:.1}):null;
function reveal(){document.querySelectorAll(".page.show .rv:not(.in)").forEach(el=>io?io.observe(el):el.classList.add("in"))}
document.addEventListener("pointerdown",e=>{const b=e.target.closest("button:not(.heart):not(.nl):not(.eye),.btn");if(!b)return;const r=b.getBoundingClientRect(),d=Math.max(r.width,r.height),s=document.createElement("span");s.className="rip";s.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`;b.appendChild(s);setTimeout(()=>s.remove(),600)});
const W=["work","skilled workers","a home to rent","land to buy"];let wi=0;
setInterval(()=>{const r=$("rot");r.classList.add("fo");setTimeout(()=>{wi=(wi+1)%W.length;r.textContent=W[wi];r.classList.remove("fo")},350)},2600);
async function countUp(){let cc=null;if(CLOUD){try{cc=await CB.counts()}catch(e){cc={}}}document.querySelectorAll(".cnt").forEach(el=>{const n=cc?(cc[el.dataset.t]||0):posts.filter(p=>p.type===el.dataset.t).length;let s=null;const step=t=>{if(!s)s=t;const k=Math.min(1,(t-s)/900);el.textContent=Math.round(n*k);if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)})}

/* ---- navigation ---- */
function go(p){
  if((p==="market"||p==="account")&&!user){toast("Please sign in first");openAuth("in");p="home"}
  page=p;
  document.querySelectorAll(".page").forEach(s=>s.classList.toggle("show",s.id==="p-"+p));
  renderMenu();window.scrollTo({top:0});
  if(p==="home")countUp();
  if(p==="market"){renderTabs();skeleton()}
  if(p==="account"){renderAccount();if(CLOUD&&!posts.length)refreshPosts().then(()=>{if(page==="account")renderAccount()})}
  reveal();
}
function renderMenu(){
  $("menu").innerHTML=PAGES.filter(([k])=>k!=="account"||user).map(([k,v])=>`<button class="nl ${k===page?"on":""}" data-go="${k}">${v}${k==="market"&&!user?" 🔒":""}</button>`).join("");
}
function renderHeader(){
  $("auth").innerHTML=user
   ?`<button class="chip" data-go="account"><span class="av">${esc(user.name[0]||"?").toUpperCase()}</span>${esc(user.name.split(" ")[0])}</button><button class="ghost" id="outBtn">Sign out</button>`
   :`<button class="ghost" id="inBtn">Sign in</button><button class="primary" id="upBtn">Join free</button>`;
  if(user)$("outBtn").onclick=async()=>{if(CLOUD){try{await CB.signOut()}catch(e){}posts=[]}user=null;store(K.sess,null);renderHeader();toast("Signed out");go("home")};
  else{$("inBtn").onclick=()=>openAuth("in");$("upBtn").onclick=()=>openAuth("up")}
  $("heroBtns").innerHTML=user?`<button class="primary big" data-go="market">Open marketplace</button>`:`<button class="primary big" id="hUp">Join free</button><button class="ghost big" id="hIn">Sign in</button>`;
  $("ctaBtn").innerHTML=user?`<button class="primary big" data-go="market">Open marketplace</button>`:`<button class="primary big" id="cUp">Create free account</button>`;
  if(!user){$("hUp").onclick=$("cUp").onclick=()=>openAuth("up");$("hIn").onclick=()=>openAuth("in")}
  renderMenu();
}

/* ---- cards ---- */
function cardHTML(p,i){
  const mine=p.owner===user.id||user.admin,saved=user.favs.includes(p.id),taken=p.status==="taken",num=norm(p.phone),img=(p.images||[])[0];
  return `<article class="card ${taken?"taken":""}" style="--i:${Math.min(i||0,12)}" data-id="${p.id}">
    ${img?`<div class="ph" style="background-image:url('${img}')"></div>`:`<div class="ph noimg">${ICON[p.type]}</div>`}
    <button class="heart ${saved?"on":""}" data-act="fav" data-id="${p.id}" aria-label="Save">♥</button>
    ${taken?`<div class="ribbon">${TAKEN[p.type]}</div>`:""}
    <div class="cb">
      <div class="tag">${LABEL[p.type]}${p.cat?" · "+esc(p.cat):""}</div>
      <h3>${esc(p.title)}</h3>
      <div class="meta">📍 ${esc(p.loc)}</div>
      ${p.price?`<div class="price">${esc(p.price)}</div>`:""}
      ${p.desc?`<div class="desc">${esc(p.desc)}</div>`:""}
      <div class="by">Posted by ${esc(p.by||"Member")}</div>
      <div class="acts">
        <a class="btn call" href="tel:${esc(num)}">Call</a>
        <a class="btn wa" href="https://wa.me/${esc(num.replace("+",""))}" target="_blank" rel="noopener">WhatsApp</a>
        ${mine?`<button class="ghost" data-act="toggle" data-id="${p.id}">${taken?"Reopen":"Mark "+TAKEN[p.type].toLowerCase()}</button><button class="del" data-act="del" data-id="${p.id}">Delete</button>`:""}
      </div></div></article>`;
}
function skeleton(){const t=++tok;$("list").innerHTML=Array(6).fill('<div class="card sk"><div class="ph"></div><div class="cb"><i></i><i></i><i style="width:60%"></i></div></div>').join("");const done=()=>{if(t===tok)renderMarket()};if(CLOUD)refreshPosts().then(done);else setTimeout(done,450)}
function renderTabs(){
  $("tabs").innerHTML=TABS.map(([k,v])=>`<button class="tab ${k===tab?"on":""}" data-k="${k}">${v}</button>`).join("");
  $("tabs").querySelectorAll("button").forEach(b=>b.onclick=()=>{tab=b.dataset.k;renderTabs();renderMarket()});
}
function renderMarket(){
  if(!user)return;
  const locs=[...new Set(posts.map(p=>p.loc.trim()))].sort(),sel=$("locF"),cur0=sel.value;
  sel.innerHTML='<option value="">All locations</option>'+locs.map(l=>`<option>${esc(l)}</option>`).join("");
  if(locs.includes(cur0))sel.value=cur0;
  const q=$("q").value.toLowerCase().trim(),l=sel.value,av=$("avail").checked;
  let items=posts.filter(p=>(tab==="all"||p.type===tab)&&(!l||p.loc.trim()===l)&&(!av||p.status!=="taken")&&(!q||[p.title,p.cat,p.loc,p.desc].join(" ").toLowerCase().includes(q)));
  if($("sort").value==="old")items=items.slice().reverse();
  $("count").textContent=items.length+" result"+(items.length===1?"":"s");
  $("list").innerHTML=items.length?items.map(cardHTML).join(""):'<div class="empty">Nothing found. Try another search, or be the first to post!</div>';
}
["q","locF","sort","avail"].forEach(id=>$(id).addEventListener(id==="q"?"input":"change",renderMarket));
function renderAccount(){
  const mine=posts.filter(p=>p.owner===user.id),sv=posts.filter(p=>user.favs.includes(p.id));
  $("prof").innerHTML=`<div class="av">${esc(user.name[0]||"?").toUpperCase()}</div><div><h2>${esc(user.name)}</h2><div class="meta">${esc(user.email)}${user.phone?" · "+esc(user.phone):""}</div></div><div class="stats"><div><b>${mine.length}</b><span>My posts</span></div><div><b>${sv.length}</b><span>Saved</span></div></div>`;
  $("acTabs").innerHTML=[["mine","My listings"],["saved","Saved"]].concat(CLOUD&&user.admin?[["admin","Admin"]]:[]).map(([k,v])=>`<button class="tab ${k===acTab?"on":""}" data-ac="${k}">${v}</button>`).join("");
  const items=acTab==="mine"?mine:sv;if(acTab==="admin"){renderAdmin();return}
  $("myList").innerHTML=items.length?items.map(cardHTML).join(""):`<div class="empty">${acTab==="mine"?"You have not posted anything yet.":"No saved listings yet. Tap the heart on a listing."}</div>`;
}
function refresh(){if(page==="market")renderMarket();if(page==="account")renderAccount();if($("dd").open&&cur)detail(cur)}

/* ---- detail ---- */
function detail(id){
  const p=posts.find(x=>x.id===id);if(!p)return;cur=id;
  const im=p.images||[],num=norm(p.phone),saved=user.favs.includes(id),taken=p.status==="taken";
  $("ddBody").innerHTML=`${im.length?`<div class="gm" id="gm" style="background-image:url('${im[0]}')"></div>${im.length>1?`<div class="th">${im.map(s=>`<img src="${s}" data-act="thumb" alt="">`).join("")}</div>`:""}`:`<div class="gm noimg" style="display:grid;place-items:center;font-size:4rem;height:160px">${ICON[p.type]}</div>`}
  <div class="db"><div class="tag">${LABEL[p.type]}${p.cat?" · "+esc(p.cat):""}${taken?" · "+TAKEN[p.type]:""}</div>
  <h2>${esc(p.title)}</h2><div class="meta">📍 ${esc(p.loc)}</div>
  ${p.price?`<div class="price">${esc(p.price)}</div>`:""}
  ${p.desc?`<div>${esc(p.desc)}</div>`:""}
  <div class="by">Posted by ${esc(p.by||"Member")}</div>
  <div class="acts"><a class="btn call" href="tel:${esc(num)}">Call</a><a class="btn wa" href="https://wa.me/${esc(num.replace("+",""))}" target="_blank" rel="noopener">WhatsApp</a>
  <button class="ghost" data-act="fav" data-id="${id}">${saved?"♥ Saved":"♡ Save"}</button><button class="ghost" data-act="share" data-id="${id}">Share</button></div>
  <div class="row" style="justify-content:space-between"><button class="link" data-act="report" data-id="${id}">⚠ Report this post</button><button class="ghost" data-act="close">Close</button></div></div>`;
  if(!$("dd").open)$("dd").showModal();
}
function share(p){
  const t=`${p.title} – ${p.loc}${p.price?" – "+p.price:""}. Call ${p.phone}. Found on SL Connect.`;
  if(navigator.share)navigator.share({title:p.title,text:t}).catch(()=>{});
  else window.open("https://wa.me/?text="+encodeURIComponent(t),"_blank","noopener");
}
function act(a,id,el){
  const p=posts.find(x=>x.id===id);
  if(a==="close"){$("dd").close();return}
  if(a==="thumb"){$("gm").style.backgroundImage=`url('${el.src}')`;return}
  if(a==="fav"){const i=user.favs.indexOf(id);i<0?user.favs.push(id):user.favs.splice(i,1);CLOUD?CB.fav(id,i<0).catch(()=>toast("Could not save, try again")):store(K.users,users);toast(i<0?"Saved ❤️":"Removed from saved")}
  else if(a==="toggle"&&p){p.status=p.status==="taken"?"open":"taken";CLOUD?CB.setStatus(id,p.status).catch(()=>toast("Could not update")):store(K.posts,posts);toast(p.status==="taken"?"Marked as "+TAKEN[p.type].toLowerCase():"Reopened")}
  else if(a==="share"&&p){share(p);return}
  else if(a==="report"&&p){if(CLOUD){CB.report(id).then(()=>toast("Thanks. We will review this post.")).catch(()=>toast("You already reported this post"))}else{p.reports=(p.reports||0)+1;store(K.posts,posts);toast("Thanks. We will review this post.")}return}
  else if(a==="del"){
    const c=document.querySelector(`.card[data-id="${id}"]`);if(c)c.classList.add("out");
    setTimeout(()=>{posts=posts.filter(x=>x.id!==id);CLOUD?CB.remove(id).catch(()=>toast("Could not delete")):store(K.posts,posts);if($("dd").open)$("dd").close();refresh();toast("Post deleted")},280);return;
  }
  refresh();
}
document.addEventListener("click",e=>{
  const g=e.target.closest("[data-go]");if(g){go(g.dataset.go);return}
  const r=e.target.closest("[data-rm]");if(r){imgs.splice(+r.dataset.rm,1);renderPrev();return}
  const ac=e.target.closest("[data-ac]");if(ac){acTab=ac.dataset.ac;renderAccount();return}
  const ad=e.target.closest("[data-adm]");if(ad){CB.dismiss(ad.dataset.adm).then(renderAdmin).catch(()=>toast("Could not dismiss"));return}
  const a=e.target.closest("[data-act]");if(a){act(a.dataset.act,a.dataset.id,a);return}
  const c=e.target.closest(".card[data-id]");if(c&&!e.target.closest("a"))detail(c.dataset.id);
});

/* ---- post ---- */
function adapt(){const t=$("type").value;$("catL").style.display=(t==="service"||t==="job")?"grid":"none"}
$("type").onchange=adapt;
function openPost(){if(!user){toast("Sign in to post");openAuth("up");return}adapt();$("phone").value=user.phone||"";$("dlg").showModal()}
$("postBtn").onclick=openPost;
$("refBtn").onclick=skeleton;
$("cancel").onclick=()=>$("dlg").close();
function shrink(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,720/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=im.width*s;c.height=im.height*s;c.getContext("2d").drawImage(im,0,0,c.width,c.height);res(c.toDataURL("image/jpeg",.72))};im.onerror=rej;im.src=r.result};r.onerror=rej;r.readAsDataURL(file)})}
function renderPrev(){$("prev").innerHTML=imgs.map((s,i)=>`<div class="pv"><img src="${s}" alt=""><button type="button" data-rm="${i}">×</button></div>`).join("")}
$("imgIn").onchange=async e=>{for(const f of[...e.target.files]){if(imgs.length>=3)break;try{imgs.push(await shrink(f))}catch(_){}}e.target.value="";renderPrev()};
$("f").onsubmit=async e=>{
  e.preventDefault();const type=$("type").value,btn=$("f").querySelector('button[type="submit"]');
  const np={type,title:$("title").value.trim(),cat:(type==="service"||type==="job")?$("cat").value.trim():"",loc:$("loc").value.trim(),price:$("price").value.trim(),phone:$("phone").value.trim(),desc:$("desc").value.trim(),images:imgs.slice(),status:"open",owner:user.id,by:user.name};
  if(CLOUD){
    btn.disabled=true;btn.textContent="Publishing...";
    try{posts.unshift(await CB.addPost(np))}catch(err){toast("Could not publish: "+CB.msg(err));return}
    finally{btn.disabled=false;btn.textContent="Publish"}
  }else{
    np.id="p"+Date.now();posts.unshift(np);
    if(!store(K.posts,posts)){posts.shift();toast("Storage is full. Use fewer or smaller photos.");return}
  }
  $("f").reset();imgs=[];renderPrev();$("dlg").close();tab=type;renderTabs();renderMarket();toast("Your post is live! 🎉");
};

/* ---- auth ---- */
function openAuth(m){
  mode=m;const up=m==="up",f=$("authF");
  $("authTitle").textContent=up?"Create account":"Sign in";
  $("asideT").textContent=up?"Join SL Connect 🇸🇱":"Welcome back 👋";
  $("authSub").textContent=up?"Free. Sign up with your email.":(CLOUD?"Use your email and password.":"Use your email or phone number.");
  $("nameL").style.display=up?"grid":"none";$("phoneL").style.display=up?"grid":"none";
  $("idLbl").textContent=up||CLOUD?"Email":"Email or phone";$("aid").placeholder=up||CLOUD?"you@email.com":"Email or phone number";$("forgot").style.display=(CLOUD&&!up)?"block":"none";
  $("apass").autocomplete=up?"new-password":"current-password";
  $("meter").style.display=up?"block":"none";$("meterI").style.width="0";
  $("authBtn").textContent=up?"Create account":"Sign in";
  $("switch").textContent=up?"Already have an account? Sign in":"New here? Create an account";
  $("autherr").textContent="";
  f.classList.remove("swap");void f.offsetWidth;f.classList.add("swap");
  if(!$("authDlg").open)$("authDlg").showModal();
}
function authErr(m){$("autherr").textContent=m;const f=$("authF");f.classList.remove("shake");void f.offsetWidth;f.classList.add("shake")}
$("switch").onclick=()=>openAuth(mode==="in"?"up":"in");
$("authCancel").onclick=()=>$("authDlg").close();
$("eye").onclick=()=>{const p=$("apass"),s=p.type==="password";p.type=s?"text":"password";$("eye").textContent=s?"🙈":"👁"};
$("apass").oninput=()=>{
  if(mode!=="up")return;const v=$("apass").value;
  const s=(v.length>=6)+(v.length>=10)+/[A-Z]/.test(v)+/\d/.test(v)+/[^\w]/.test(v);
  $("meterI").style.width=s*20+"%";$("meterI").style.background=s<=2?"#e0245e":s<=3?"#f5a623":"#1eb53a";
};
function findUser(idf){const v=idf.trim().toLowerCase();return v.includes("@")?users.find(u=>u.email===v):users.find(u=>u.phone&&u.phone===norm(v))}
function welcome(name,isNew){
  $("wText").textContent=isNew?`Welcome, ${name.split(" ")[0]}!`:`Welcome back, ${name.split(" ")[0]}!`;
  $("welcome").classList.add("show");
  setTimeout(()=>{$("welcome").classList.remove("show");go("market")},1900);
}
$("authF").onsubmit=async e=>{
  e.preventDefault();
  const idf=$("aid").value.trim(),pw=$("apass").value,btn=$("authBtn");
  const fail=m=>{btn.classList.remove("load");btn.disabled=false;authErr(m)};
  if(!idf||!pw)return authErr("Please fill in all fields.");
  btn.classList.add("load");btn.disabled=true;
  if(CLOUD){
    try{
      if(mode==="up"){
        const name=$("aname").value.trim(),phone=norm($("aphone").value);
        if(!name)return fail("Please enter your name.");
        if(!/^\S+@\S+\.\S+$/.test(idf))return fail("Enter a valid email address.");
        if(pw.length<6)return fail("Password must be at least 6 characters.");
        const r=await CB.signUp({name,email:idf,phone,password:pw});
        if(r.needsConfirm){btn.classList.remove("load");btn.disabled=false;$("authDlg").close();$("authF").reset();toast("Check your email to confirm your account 📧");return}
        user=r.user;
      }else{user=await CB.signIn(idf,pw)}
    }catch(err){return fail(CB.msg(err))}
    btn.classList.remove("load");btn.disabled=false;$("authDlg").close();$("authF").reset();renderHeader();welcome(user.name,mode==="up");return;
  }
  await wait(800);const h=await hash(pw);let u;
  if(mode==="up"){
    const email=idf.toLowerCase(),name=$("aname").value.trim(),phone=norm($("aphone").value);
    if(!name)return fail("Please enter your name.");
    if(!/^\S+@\S+\.\S+$/.test(email))return fail("Enter a valid email address.");
    if(pw.length<6)return fail("Password must be at least 6 characters.");
    if(users.some(x=>x.email===email))return fail("This email already has an account. Sign in instead.");
    if(phone&&users.some(x=>x.phone===phone))return fail("This phone number is already used.");
    u={id:email,name,email,phone,hash:h,favs:[]};users.push(u);
    if(!store(K.users,users)){users.pop();return fail("Could not save your account. Storage is full.")}
  }else{
    u=findUser(idf);if(!u||u.hash!==h)return fail("Wrong email/phone or password.");
  }
  user=u;store(K.sess,u.id);btn.classList.remove("load");btn.disabled=false;
  $("authDlg").close();$("authF").reset();renderHeader();welcome(u.name,mode==="up");
};

/* ---- contact ---- */
$("cPhone").innerHTML=`<a href="tel:${esc(CONTACT_PHONE)}" style="color:inherit">${esc(CONTACT_PHONE)}</a>`;
$("cMail").innerHTML=`<a href="mailto:${esc(CONTACT_EMAIL)}" style="color:inherit">${esc(CONTACT_EMAIL)}</a>`;
$("cF").onsubmit=e=>{
  e.preventDefault();
  const msg=`Hello SL Connect, I am ${$("cn").value} (${$("cc").value}). ${$("cm").value}`;
  window.open("https://wa.me/"+CONTACT_PHONE.replace(/\D/g,"")+"?text="+encodeURIComponent(msg),"_blank","noopener");
  $("cF").reset();toast("Opening WhatsApp...");
};

/* ===== APP FEATURES: logo, splash, bottom bar, install, founder, offline ===== */
const LOGO=`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="gX" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1eb53a"/><stop offset="1" stop-color="#0072c6"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#gX)"/><circle cx="25" cy="29" r="12" fill="none" stroke="#fff" stroke-width="5"/><circle cx="39" cy="29" r="12" fill="none" stroke="#fff" stroke-width="5" opacity=".85"/><rect x="14" y="49" width="12" height="4" rx="2" fill="#fff"/><rect x="26" y="49" width="12" height="4" rx="2" fill="#fff" opacity=".7"/><rect x="38" y="49" width="12" height="4" rx="2" fill="#fff" opacity=".45"/></svg>`;
document.querySelectorAll("[data-logo]").forEach((e,i)=>e.innerHTML=LOGO.replace(/gX/g,"g"+i));
(function(){const s=$("splash");let seen=false;try{seen=sessionStorage.getItem("sl_splash")}catch(e){}
 if(seen){s.remove();return}try{sessionStorage.setItem("sl_splash","1")}catch(e){}
 setTimeout(()=>{s.classList.add("gone");setTimeout(()=>s.remove(),700)},1700)})();
function renderBottom(){
  const it=[["home","🏠","Home"],["market","🛍️","Market"],["post","➕","Post"],["account","👤",user?"Me":"Sign in"],["about","ℹ️","About"]];
  $("bnav").innerHTML=it.map(([k,i,l])=>k==="post"?`<button class="bpost" id="bnPost" aria-label="Post">${i}</button>`:`<button class="bi ${k===page?"on":""}" data-go="${k}"><span>${i}</span>${l}</button>`).join("");
  $("bnPost").onclick=openPost;
}
const _rm=renderMenu;renderMenu=function(){_rm();renderBottom()};
let cloudFounder="";
K.fphoto="slconnect_founder_photo";
function renderFounder(){
  const ph=(CLOUD?cloudFounder:load(K.fphoto,""))||FOUNDER_PHOTO,n=FOUNDER_NAME.split(" "),can=CLOUD?!!(user&&user.admin):!!(user&&FOUNDER_EMAIL&&user.email===FOUNDER_EMAIL.toLowerCase());
  $("fName").textContent=FOUNDER_NAME;
  $("fPhoto").style.backgroundImage=ph?`url('${ph}')`:"";
  $("fPhoto").textContent=ph?"":(n[0][0]+n[n.length-1][0]).toUpperCase();
  $("fUp").style.display=can?"inline-block":"none";
}
$("fIn").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const d=await shrink(f);if(CLOUD){await CB.setFounderPhoto(d);cloudFounder=await CB.founderPhoto();renderFounder();toast("Founder photo updated")}else if(store(K.fphoto,d)){renderFounder();toast("Founder photo updated")}else toast("Photo too big. Try a smaller one.")}catch(_){toast("Could not read that photo")}e.target.value=""};
const _rh=renderHeader;renderHeader=function(){_rh();renderFounder()};
let dip=null;
addEventListener("beforeinstallprompt",e=>{e.preventDefault();dip=e});
addEventListener("appinstalled",()=>{toast("App installed 🎉");dip=null});
if(matchMedia("(display-mode: standalone)").matches||navigator.standalone)document.querySelectorAll(".inst").forEach(b=>b.classList.add("hide"));
document.addEventListener("click",e=>{if(!e.target.closest(".inst"))return;
  if(dip){dip.prompt();dip.userChoice.finally(()=>dip=null)}else toast("Android: menu ⋮ → Install app. iPhone: Share → Add to Home Screen")});
document.addEventListener("pointerdown",e=>{if(e.target.closest("button,.btn")&&navigator.vibrate)try{navigator.vibrate(8)}catch(_){}});
addEventListener("offline",()=>toast("You are offline"));
addEventListener("online",()=>toast("Back online ✅"));
if("serviceWorker" in navigator&&location.protocol.startsWith("http")){addEventListener("load",()=>{try{navigator.serviceWorker.register("sw.js").catch(()=>{})}catch(e){}})}

/* ===== CLOUD HELPERS ===== */
async function refreshPosts(){try{posts=await CB.posts()}catch(e){toast("Could not load listings. Check your internet.")}}
async function renderAdmin(){
  $("myList").innerHTML='<div class="empty">Loading reports...</div>';
  try{const rs=await CB.reports();
    $("myList").innerHTML=rs.length?rs.map(r=>`<div class="card" style="cursor:default"><div class="cb"><div class="tag">Reported</div><h3>${esc(r.posts?r.posts.title:"(post already deleted)")}</h3><div class="meta">📍 ${esc(r.posts?r.posts.loc:"")}</div><div class="by">Reason: ${esc(r.reason||"not given")}</div><div class="acts">${r.posts?`<button class="del" data-act="del" data-id="${r.post_id}">Delete post</button>`:""}<button class="ghost" data-adm="${r.id}">Dismiss</button></div></div></div>`).join(""):'<div class="empty">No reports. 🎉</div>';
  }catch(e){$("myList").innerHTML='<div class="empty">Could not load reports.</div>'}
}
$("forgot").onclick=async()=>{const em=$("aid").value.trim();
  if(!/^\S+@\S+\.\S+$/.test(em))return authErr("Type your email above first, then tap Forgot password.");
  try{await CB.reset(em);toast("Password reset email sent 📧")}catch(err){authErr(CB.msg(err))}};
function openPw(){$("pwF").reset();$("pwerr").textContent="";if(!$("pwDlg").open)$("pwDlg").showModal()}
$("pwCancel").onclick=()=>$("pwDlg").close();
$("pwF").onsubmit=async e=>{e.preventDefault();const v=$("npass").value;
  if(v.length<6){$("pwerr").textContent="At least 6 characters.";return}
  try{await CB.setPassword(v);$("pwDlg").close();toast("Password updated ✅")}catch(err){$("pwerr").textContent=CB.msg(err)}};
(async()=>{
  if(CLOUD_ON&&!CLOUD)toast("Cloud library did not load. Running in demo mode.");
  if(CLOUD){try{user=await CB.init(()=>setTimeout(openPw,0));cloudFounder=await CB.founderPhoto()}catch(e){toast("Could not reach the server")}}
  renderHeader();go(user?"market":"home");
})();
