/* ==========================
wrap.appendChild(card);
});
wrap.classList.remove('fade-out');
}, 350);
}


render();
setInterval(()=>{ index = (index+1) % reviews.length; render(); }, 8000); // 8 sn'de bir yumuşak dönüşüm
})();


/* ----------------------
YOUTUBE ŞERİT (3 sütun)
---------------------- */
(function initYouTube(){
const grid = $('#ytGrid');
if (!grid) return;


// Buraya kendi video ID'lerini koy. İlk 5 video yeterli.
// Örn: https://www.youtube.com/watch?v=VIDEO_ID
const videoIds = [
'Q8ZqCF1JT98', // Örnek ID – değiştir
'5qap5aO4i9A', // Örnek ID – değiştir
'ysz5S6PUM-U', // Örnek ID – değiştir
'dQw4w9WgXcQ', // Örnek ID – değiştir
'o-YBDTqX_ZU' // Örnek ID – değiştir
];


let start = 0; // 1-2-3


function embed(id){
const div = document.createElement('div');
div.className = 'yt-card';
div.innerHTML = `
<iframe src="https://www.youtube.com/embed/${id}" title="YouTube video player" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>
`;
return div;
}


function render(){
grid.innerHTML = '';
for (let i=0;i<3;i++){
const id = videoIds[(start+i)];
if (id) grid.appendChild(embed(id));
}
}


render(); // 1-2-3


// 7 sn sonra 2-3-4, sonra 3-4-5, sonra başa dön
setInterval(()=>{
if (start < Math.max(0, videoIds.length - 3)){
start += 1;
} else {
start = 0; // başa sar
}
render();
}, 7000);
})();
})();
