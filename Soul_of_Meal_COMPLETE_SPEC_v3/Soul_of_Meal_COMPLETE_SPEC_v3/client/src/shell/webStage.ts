import Phaser from 'phaser';
import titleUrl from '../../assets/original/scenes/title.webp';
import homeUrl from '../../assets/original/scenes/home.webp';

export function mountWebStage(host: HTMLElement) {
  let page = host.dataset.scene ?? 'title';
  let reduceMotion = false;

  class Backdrop extends Phaser.Scene {
    private image?: Phaser.GameObjects.Image;
    private motes: Phaser.GameObjects.Arc[] = [];

    preload() {
      this.load.image('title', titleUrl);
      this.load.image('home', homeUrl);
    }

    create() {
      this.motes = Array.from({ length: 19 }, (_, index) =>
        this.add.circle(0, 0, 1 + (index % 3) * .48, 0xffc875));
      this.scale.on('resize', this.draw, this);
      this.events.once('shutdown', () => this.scale.off('resize', this.draw, this));
      this.draw();
      if (page !== 'title' && page !== 'home') this.scene.sleep();
    }

    draw() {
      const key = page === 'home' ? 'home' : 'title';
      const visible = (page === 'home' || page === 'title') && this.textures.exists(key);
      const { width, height } = this.scale.gameSize;

      if (visible) {
        this.image ??= this.add.image(0, 0, key).setDepth(-1).setOrigin(0);
        const image = this.image.setTexture(key).setVisible(true);
        image.setScale(Math.max(width / image.width, height / image.height));
        const focus = width < height ? (key === 'title' ? .7 : .57) : .5;
        image.setPosition((width - image.displayWidth) * focus, (height - image.displayHeight) * .5);
      } else {
        this.image?.setVisible(false);
      }

      for (const mote of this.motes) mote.setVisible(visible && !reduceMotion);
      host.dataset.renderer = visible
        ? (this.game.renderer.type === Phaser.WEBGL ? 'webgl' : 'canvas')
        : '';
    }

    update(time: number) {
      if (reduceMotion) return;
      const { width, height } = this.scale.gameSize;
      this.motes.forEach((mote, index) => {
        const x = ((index * 67 % 101) / 101) * width + Math.sin(index + time / 2600) * 20;
        const y = height - ((time / (115 + index % 4 * 21) + index * 49) % 1000) * height / 1000;
        mote.setPosition(x, y).setAlpha(.24 + .19 * Math.sin(time / 900 + index));
      });
    }
  }

  const scene = new Backdrop('backdrop');
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    transparent: true,
    scene: [scene],
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scale: { mode: Phaser.Scale.RESIZE, width: host.clientWidth, height: host.clientHeight },
  });

  function sync() {
    if (!scene.sys.isActive() && !scene.sys.isSleeping()) return;
    const visible = page === 'home' || page === 'title';
    if (visible) {
      if (scene.sys.isSleeping()) game.scene.wake('backdrop');
      scene.draw();
    } else {
      host.dataset.renderer = '';
      if (scene.sys.isActive()) game.scene.sleep('backdrop');
    }
  }

  return {
    show(nextPage: string) {
      page = nextPage;
      sync();
    },
    setReducedMotion(value: boolean) {
      reduceMotion = value;
      sync();
    },
  };
}
