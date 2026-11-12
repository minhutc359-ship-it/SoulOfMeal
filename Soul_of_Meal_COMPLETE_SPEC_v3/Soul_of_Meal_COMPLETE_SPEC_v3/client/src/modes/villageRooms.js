export const VILLAGE_ROOMS = Object.freeze(['village_kitchen', 'village_guild', 'village_merchant']);
export const ROOM_EXIT = 'room_exit';

export function buyVillageSupplies(save, offer) {
  if (!Number.isSafeInteger(offer?.gold) || offer.gold <= 0
      || !Number.isSafeInteger(offer.essence) || offer.essence <= 0) {
    return { save, purchased: false };
  }
  if (!Number.isSafeInteger(save.player.gold) || save.player.gold < offer.gold
      || !Number.isSafeInteger(save.player.essence) || !Number.isSafeInteger(save.player.essence + offer.essence)) {
    return { save, purchased: false };
  }
  return {
    save: { ...save, player: { ...save.player, gold: save.player.gold - offer.gold, essence: save.player.essence + offer.essence } },
    purchased: true,
  };
}
