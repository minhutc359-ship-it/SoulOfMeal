import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from scripts.publish_web_release import activate, publish


class WebReleaseTests(unittest.TestCase):
    def test_publish_and_rollback_keep_prior_build_intact(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "vite"
            public = root / "public"
            files = {
                "client/index.html": "first version",
                "examples/maps/village.json": "{}",
                "examples/cards/cards.catalog.json": "{}",
            }
            for name, content in files.items():
                path = source / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")
            first = publish(source, public)
            self.assertEqual(publish(source, public), first)
            (source / "client/index.html").write_text("second version", encoding="utf-8")
            second = publish(source, public)
            self.assertNotEqual(first, second)
            pointer = public / "release.json"
            self.assertEqual(json.loads(pointer.read_text())["build"], second)
            self.assertEqual((public / "releases" / first / "client/index.html").read_text(), "first version")
            self.assertEqual(activate(public, first), first)
            (public / "releases" / second / "examples/maps/village.json").unlink()
            with self.assertRaises(ValueError):
                activate(public, second)
            self.assertEqual(json.loads(pointer.read_text())["build"], first)
