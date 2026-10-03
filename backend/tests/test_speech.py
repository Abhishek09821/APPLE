import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from speech import spoken_text, spoken_result

class SpeechTests(unittest.TestCase):
    def test_emoji_urls_and_markdown_are_not_read(self):
        self.assertEqual(spoken_text('😊 **Done!** Open [your notes](https://example.com/notes).'), 'Done! Open your notes.')
        text = spoken_text('Found it https://www.google.com/search?q=Virat 👋🏽 ❤️')
        self.assertNotIn('http', text)
        self.assertNotIn('Virat', text)
        self.assertNotIn('👋', text)
    def test_long_replies_leave_details_on_screen(self):
        self.assertEqual(spoken_text('One. Two. Three. Four.'), 'One. Two. Three. The details are on screen.')
        self.assertLess(len(spoken_text('Long words ' * 500)), 480)
    def test_code_and_emoji_only(self):
        self.assertEqual(spoken_text('😊👋'), '')
        self.assertNotIn('pip', spoken_text('Try this. ```sh\npip install x\n```'))
    def test_domain_suffixes_are_not_partially_spoken(self):
        self.assertEqual(spoken_text('Visit example.company. Done.'), 'Visit. Done.')
        self.assertEqual(spoken_text('Visit example.network. Done.'), 'Visit. Done.')
        self.assertEqual(spoken_text('Open example.compression and README.md.'), 'Open example.compression and README.md.')
    def test_preserve_non_english_and_meaningful_numbers(self):
        self.assertEqual(spoken_text('नमस्ते! Meet at 7:30 PM.'), 'नमस्ते! Meet at 7:30 PM.')
    def test_search_announces_query_not_raw_result_url(self):
        self.assertEqual(spoken_result('Opened https://google.com/search?q=test', [{'action':'google_search','target':'Virat Kohli','success':True}]), 'Opened search results for Virat Kohli.')
    def test_failures_are_never_narrated_as_success(self):
        self.assertEqual(spoken_result('Permission denied.', [{'action':'open_website','success':False}]), 'Permission denied.')
