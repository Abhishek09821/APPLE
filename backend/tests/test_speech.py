import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from speech import (
    spoken_text,
    spoken_result,
    detect_language,
    get_voice_for_persona,
    list_voices,
    _compute_pitch_hz,
    VOICE_REGISTRY,
)

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

    # ─── Language Detection Tests ───
    def test_detect_language_hindi_devanagari(self):
        self.assertEqual(detect_language('नमस्ते, आप कैसे हैं?'), 'hi')
        self.assertEqual(detect_language('सर, आपकी रिक्वेस्ट प्रोसेस हो रही है।'), 'hi')

    def test_detect_language_english(self):
        self.assertEqual(detect_language('Hello! How can I help you today?'), 'en')
        self.assertEqual(detect_language('Open the browser and search for Apple.'), 'en')

    def test_detect_language_hinglish(self):
        self.assertEqual(detect_language('Arre tension mat lo! Main hoon na.'), 'hi')
        self.assertEqual(detect_language('Arre yaar, chill karo! Main handle kar lunga sab kuch!'), 'hi')
        self.assertEqual(detect_language('Namaste! Main aapki help ke liye hamesha ready hoon.'), 'hi')
        self.assertEqual(detect_language('Sir, aapki request process ho gayi hai.'), 'hi')

    def test_detect_language_code_switching(self):
        # Code-switching in same sentence with Devanagari routes to native Hindi voice
        self.assertEqual(detect_language('नमस्ते, your meeting at 5 PM is confirmed!'), 'hi')
        self.assertEqual(detect_language('Main tumhara Hero hoon, ready for anything!'), 'hi')

    # ─── Persona Voice Selection Tests ───
    def test_hero_persona_voices(self):
        # Native Hindi for Hindi text
        self.assertEqual(get_voice_for_persona('hero', 'नमस्ते! Main tumhara Hero hoon!'), 'Lekha')
        # Energetic Indian English for English
        self.assertEqual(get_voice_for_persona('hero', 'Hey! No worries, I got this. Your Hero is here!'), 'Rishi')

    def test_jarvis_persona_voices(self):
        # Native Hindi for Hindi
        self.assertEqual(get_voice_for_persona('jarvis', 'सर, आपकी फाइल तैयार है।'), 'Lekha')
        # Deep calm Indian English for English
        self.assertEqual(get_voice_for_persona('jarvis', 'Sir, I have processed your request. Everything is in order.'), 'Aman')

    def test_natural_persona_voices(self):
        # Native Hindi for Hindi
        self.assertEqual(get_voice_for_persona('natural', 'नमस्ते! मैं आपकी मदद करूँगी।'), 'Lekha')
        # Natural Indian English for English
        self.assertEqual(get_voice_for_persona('natural', 'Hello! I am always ready to help you with anything.'), 'Tara')

    def test_unknown_persona_fallback(self):
        # Unknown persona falls back to natural
        self.assertEqual(get_voice_for_persona('unknown_persona', 'Hello'), 'Tara')

    # ─── Voice Registry and Metadata Tests ───
    def test_list_voices_contains_all_personas(self):
        voices = list_voices()
        persona_ids = [v['id'] for v in voices]
        self.assertIn('hero', persona_ids)
        self.assertIn('jarvis', persona_ids)
        self.assertIn('natural', persona_ids)
        for v in voices:
            self.assertIn('label', v)
            self.assertIn('description', v)
            self.assertIn('voices', v)
            self.assertIn('hi', v['voices'])
            self.assertIn('en', v['voices'])

    # ─── Pitch Calculation Tests ───
    def test_compute_pitch_hz(self):
        # Default pitch multiplier = 1.0
        hero_pitch_en = _compute_pitch_hz('hero', 'en', 1.0)
        jarvis_pitch_en = _compute_pitch_hz('jarvis', 'en', 1.0)
        self.assertGreater(hero_pitch_en, jarvis_pitch_en)  # Hero is higher/youthful, Jarvis is deeper

        # Pitch scales with multiplier
        low_pitch = _compute_pitch_hz('hero', 'en', 0.5)
        high_pitch = _compute_pitch_hz('hero', 'en', 2.0)
        self.assertLess(low_pitch, hero_pitch_en)
        self.assertGreater(high_pitch, hero_pitch_en)

        # Clamping
        self.assertGreaterEqual(_compute_pitch_hz('jarvis', 'en', 0.1), 50)
        self.assertLessEqual(_compute_pitch_hz('natural', 'hi', 5.0), 320)


if __name__ == '__main__':
    unittest.main()
