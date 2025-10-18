/* main.js v11 — Elçi Veteriner Kliniği
{id:'3JZ_D3ELwOQ', title:'Kısırlaştırma Sonrası Bakım Rehberi'},
{id:'L_jWHffIx5E', title:'Röntgen ve Ultrason: Hangi Durumda Hangisi?'}
];


function ytEmbedHTML(v){
const src = `https://www.youtube.com/embed/${v.id}?rel=0`;
return `
<div class="yt-card slide-enter">
<div class="yt-thumb">
<iframe width="100%" height="100%" src="${src}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>
<div class="yt-body"><strong>${v.title||''}</strong></div>
</div>
`;
}


async function renderYouTube(){
if(!ytGrid) return;
const data = await fetchJSON('assets/data/youtube.json') || defaultVideos;
let start = 0; // 0-1-2 ile başla


function draw(){
ytGrid.innerHTML = '';
for(let i=0;i<3;i++){
const v = data[(start+i)%data.length];
ytGrid.insertAdjacentHTML('beforeend', ytEmbedHTML(v));
}
}


draw();
// 7 sn sonra bir sağa kaydır → 1-2-3, sonra 2-3-4 ...
setInterval(()=>{
// çıkış animasyonu ekle
$$('.yt-card', ytGrid).forEach(el=> el.classList.add('slide-exit'));
setTimeout(()=>{
start = (start + 1) % data.length;
draw();
}, 550);
}, 7000);
}


// === BLOG & ABOUT TEASER === (örnek/dummy)
const blogGrid = $('#blogGrid');
function renderBlog(){
if(!blogGrid) return;
const posts = [
{img:'assets/img/uploads/blog1.jpg', title:'Kedilerde Ağız ve Diş Sağlığı', text:'Evde bakım ipuçları ve klinikte yapılması gerekenler.'},
{img:'assets/img/uploads/blog2.jpg', title:'Köpeklerde Aşılama Programı', text:'Yaşa göre aşı takvimi ve parazit kontrolü.'},
{img:'assets/img/uploads/blog3.jpg', title:'Acil Durum Rehberi', text:'İlk müdahale adımları ve ne zaman kliniğe gelmeli?'}
];
blogGrid.innerHTML = '';
posts.forEach(p=>{
const card = document.createElement('div');
card.className = 'blog-card';
card.innerHTML = `
<div class="thumb"><img src="${p.img}" alt="${p.title}" onerror="this.parentElement.style.display='none'"></div>
<div class="body"><h3>${p.title}</h3><p>${p.text}</p></div>
`;
blogGrid.appendChild(card);
});
}


async function renderAboutTeasers(){
const elci = $('#elciKimdirCard .content');
const misyon = $('#misyonVizyonCard .content');
if(elci) elci.textContent = 'Veteriner hekimliğin farklı branşlarında tecrübe; etik, şeffaf ve bilimsel yaklaşım.';
if(misyon) misyon.textContent = 'Amacımız, evcil dostlarınıza güvenli ve konforlu bir tedavi deneyimi sunmak.';
}


// === INIT ===
document.addEventListener('DOMContentLoaded', ()=>{
renderInsta();
renderReviews();
renderYouTube();
renderBlog();
renderAboutTeasers();
});
})();
