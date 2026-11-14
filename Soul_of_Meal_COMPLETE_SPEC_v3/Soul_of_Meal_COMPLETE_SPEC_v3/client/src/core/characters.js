export const CHARACTERS = Object.freeze({
  chr_bunbo_holinh: {
    name: "Bún Bò Hỏa Linh",
    element: "fire",
    role: "fighter",
    dish: "Bún bò Huế",
    story: "Ngọn lửa ấm của căn bếp Huế sống trong từng đường hỏa đao.",
  },
  chr_pho_lamvu: {
    name: "Phở Lam Vũ",
    element: "water",
    role: "mage",
    dish: "Phở Việt",
    story: "Làn hơi nước dùng lưu giữ ký ức những buổi sớm bình yên.",
  },
  chr_goicuon_diepnhi: {
    name: "Gỏi Cuốn Diệp Nhi",
    element: "wood",
    role: "support",
    dish: "Gỏi cuốn",
    story: "Những chiếc lá gia vị đem lại sức sống cho cả đội.",
  },
  chr_banhbao_bachngoc: {
    name: "Bánh Bao Bạch Ngọc",
    element: "light",
    role: "guardian",
    dish: "Bánh bao",
    story: "Một chiếc thìa, một nụ cười và ý chí bảo vệ bạn bè.",
  },
  chr_caphe_davu: {
    name: "Cà Phê Dạ Vũ",
    element: "shadow",
    role: "assassin",
    dish: "Cà phê Việt",
    story: "Hương cà phê sâu lắng giấu những bước chân trong bóng tối.",
  },
});
export const ELEMENTS = Object.freeze({
  fire: "Hỏa",
  water: "Thủy",
  wood: "Mộc",
  light: "Quang",
  shadow: "Âm",
});
export const ROLES = Object.freeze({
  fighter: "Đấu Sĩ",
  guardian: "Hộ Vệ",
  mage: "Pháp Sư",
  ranged: "Xạ Thủ",
  support: "Hỗ Trợ",
  assassin: "Sát Thủ",
});
export function characterArt(card) {
  return card.character_id && CHARACTERS[card.character_id]
    ? `./assets/portraits/${card.character_id}.png`
    : `./assets/cards/${card.card_id}.png`;
}
