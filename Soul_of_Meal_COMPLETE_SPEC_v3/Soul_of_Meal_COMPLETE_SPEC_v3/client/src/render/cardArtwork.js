import catalog from './splashCatalog.json' with { type: 'json' };
import { SPIRITS } from '../modes/metaProgress.js';
import { artworkImage } from './artworkImages.js';

export const cardIllustration = id => catalog.cards[id] ?? null;
export const spiritIllustration = id => catalog.characters[id] ?? null;
export const cardBackIllustration = () => catalog.back;
export const escapeArtText = value => String(value ?? '').replace(/[&<>"']/g, symbol =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[symbol]);
const ELEMENTS = { fire:['✹','Hỏa'], water:['◈','Thủy'], wood:['❧','Mộc'], light:['✦','Quang'], shadow:['☾','Âm'] };
const ROLES = { fighter:'Đấu Sĩ',guardian:'Hộ Vệ',mage:'Pháp Sư',ranged:'Xạ Thủ',support:'Hỗ Trợ',healer:'Hồi Phục',controller:'Khống Chế',assassin:'Sát Thủ' };
const TYPES = { unit:'Vị Linh',fast_spell:'Phép nhanh',slow_spell:'Phép chậm',burst_spell:'Phép tức thì',trap:'Bẫy' };

export function tcgCardFace(card, { rule = '', cost = card.cost } = {}) {
  const art=cardIllustration(card.card_id);
  const elementId=Object.hasOwn(ELEMENTS,card.element)?card.element:'light';
  const [glyph,element]=ELEMENTS[elementId];
  const rarity=['N','R','SR','SSR'].includes(card.rarity) ? card.rarity : 'R';
  const roleId=card.keywords?.includes('guard') ? 'guardian' : card.job ?? SPIRITS[card.character_id]?.role;
  const role=ROLES[roleId];
  const roleGlyph={fighter:'⚔',guardian:'⬡',mage:'✧',ranged:'➶',support:'❀',healer:'✚',controller:'⌘',assassin:'☾'}[roleId];
  const text=escapeArtText;
  return `<article class="tcg-card-face rarity-${rarity.toLowerCase()} element-${elementId}" aria-label="Thẻ ${text(card.display_name)}">
    <header><strong>${text(card.display_name)}</strong><span class="face-mana" aria-label="${text(cost)} mana">${text(cost)}</span></header>
    <div class="face-art">${artworkImage(art, { alt: `Minh họa ${card.display_name}`, characterId: card.character_id })}</div>
    <div class="face-type"><span><i aria-hidden="true">${glyph}</i> ${element} · ${roleGlyph ? `<i aria-hidden="true">${roleGlyph}</i> `:''}${text(role ?? TYPES[card.type])}</span><b>${rarity}</b></div>
    <div class="face-rules">${card.skill_name ? `<strong>${text(card.skill_name)}</strong>` : ''}<p>${text(rule)}</p></div>
    ${card.type==='unit' ? `<footer><b>ATK <span>${text(card.atk)}</span></b><b>DEF <span>${text(card.max_def)}</span></b></footer>` : `<footer><span>${text(TYPES[card.type])}</span><span>SOUL OF MEAL</span></footer>`}
  </article>`;
}

export function openFullArtwork(openDialog, art, name) {
  if (!art) return;
  const dialog=openDialog(name+' · Minh họa', `<figure class="full-art-figure"><img src="${art.preview}" alt="${escapeArtText(name)}"><figcaption>${escapeArtText(name)} · ${art.width} × ${art.height}</figcaption><p role="status">Đang mở bản HD…</p></figure>`);
  dialog.classList.add('full-art-dialog');
  const image=dialog.querySelector('.full-art-figure img'),status=dialog.querySelector('[role="status"]');
  image.addEventListener('load',()=>{status.textContent=image.getAttribute('src')===art.hd ? 'Minh họa HD' : 'Bản xem trước';});
  image.addEventListener('error',()=>{image.src=art.preview;status.textContent='Đang dùng bản xem trước. Kết nối mạng để tải bản HD.';},{once:true});
  image.src=art.hd;
}

export function openArtCollection(openDialog, cards, showCard) {
  const text=escapeArtText;
  const entries=[...cards.map(c=>({id:c.card_id,kind:'card',name:c.display_name,element:c.element,art:cardIllustration(c.card_id)})),
    ...Object.values(SPIRITS).map(s=>({id:s.id,kind:'spirit',name:s.name,element:s.element,art:spiritIllustration(s.id)}))].filter(e=>e.art);
  const dialog=openDialog('Bộ sưu tập minh họa',`<div class="artbook"><p>${cards.length} thẻ · ${Object.keys(SPIRITS).length} Vị Linh</p>
    <div class="artbook-filters"><input type="search" aria-label="Tìm minh họa" placeholder="Tên thẻ hoặc Vị Linh" data-art-search><select aria-label="Nhóm minh họa" data-art-kind><option value="">Tất cả</option><option value="card">Thẻ bài</option><option value="spirit">Vị Linh</option></select><select aria-label="Hệ minh họa" data-art-element><option value="">Mọi hệ</option>${Object.entries(ELEMENTS).map(([id,[,name]])=>`<option value="${id}">${name}</option>`).join('')}</select></div>
    <div class="artbook-grid">${entries.map(e=>`<button type="button" data-art-id="${e.id}" data-art-kind="${e.kind}" data-art-element="${e.element}" data-art-name="${text(e.name.toLocaleLowerCase('vi'))}">${artworkImage(e.art, { alt: e.name, characterId: e.kind === 'spirit' ? e.id : '', lazy: true })}<strong>${text(e.name)}</strong><small>${e.kind==='card'?'Thẻ bài':'Vị Linh'}</small></button>`).join('')}</div><p data-art-empty hidden>Không có minh họa phù hợp.</p></div>`);
  dialog.classList.add('artbook-dialog');
  const search=dialog.querySelector('[data-art-search]'),kind=dialog.querySelector('select[data-art-kind]'),element=dialog.querySelector('select[data-art-element]');
  function filter(){
    let count=0;
    for(const button of dialog.querySelectorAll('button[data-art-id]')){
      button.hidden=!(button.dataset.artName.includes(search.value.trim().toLocaleLowerCase('vi'))&&(!kind.value||button.dataset.artKind===kind.value)&&(!element.value||button.dataset.artElement===element.value));
      if(!button.hidden)count++;
    }
    dialog.querySelector('[data-art-empty]').hidden=count>0;
  }
  for(const input of [search,kind,element])input.addEventListener('input',filter);
  for(const button of dialog.querySelectorAll('[data-art-id]'))button.onclick=()=>{
    const entry=entries.find(e=>e.id===button.dataset.artId&&e.kind===button.dataset.artKind);
    if(entry.kind==='card')showCard(entry.id);else openFullArtwork(openDialog,entry.art,entry.name);
  };
}
