import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import storage
import main
from contacts import Contact, save_contact, resolve_contact, resolve_whatsapp_action
from models import Action


class ContactTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.patch = patch.object(storage, 'DATA_DIR', Path(self.tmp.name))
        self.patch.start()
        self.client = TestClient(main.app)
        self.headers = {'X-Apple-Token': main.TOKEN}

    def tearDown(self):
        self.client.close(); self.patch.stop(); self.tmp.cleanup()

    def test_crud_aliases_phone_normalization_and_delete(self):
        body = {'name':'Test Mother', 'phone':'+91 (98765) 43210', 'aliases':['Mummy','माँ','mummy']}
        response = self.client.post('/api/contacts', json=body, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        contact = response.json()
        self.assertEqual(contact['phone'], '+919876543210')
        self.assertEqual(contact['aliases'], ['Mummy','माँ'])
        self.assertEqual(resolve_contact('MUMMY!')['id'], contact['id'])
        self.assertEqual(resolve_contact('माँ')['id'], contact['id'])
        self.assertIsNone(resolve_contact('Mum'))
        changed = self.client.put('/api/contacts/'+contact['id'], headers=self.headers,
            json={**body,'aliases':['Mom']})
        self.assertEqual(changed.status_code, 200)
        self.assertIsNone(resolve_contact('Mummy'))
        self.client.delete('/api/contacts/'+contact['id'], headers=self.headers)
        self.assertEqual(self.client.get('/api/contacts').json(), [])

    def test_conflicting_aliases_numbers_and_invalid_numbers_are_rejected(self):
        save_contact(Contact(name='Test One',phone='+919876543210',aliases=['Dad']))
        for value in [Contact(name='Test Two',phone='+919876543211',aliases=['dad']),
                      Contact(name='Test Two',phone='+919876543210')]:
            with self.assertRaises(ValueError): save_contact(value)
        for phone in ['9876543210', '+919876543210&text=bad', '+09123456789']:
            response = self.client.post('/api/contacts', headers=self.headers, json={'name':'Test','phone':phone})
            self.assertEqual(response.status_code, 422)

    def test_model_cannot_invent_the_expected_native_header(self):
        action = Action(action='whatsapp_send',target='+919876543210',message='hi',control='Invented')
        self.assertEqual(resolve_whatsapp_action(action).control, '')
        save_contact(Contact(name='Test Mother',phone='+919876543210',aliases=['Mummy']))
        resolved = resolve_whatsapp_action(action)
        self.assertEqual(resolved.control, 'Test Mother')

    def test_spoken_alias_routes_to_number_without_model_or_real_send(self):
        save_contact(Contact(name='Test Mother',phone='+919876543210',aliases=['Mummy','माँ']))
        self.client.put('/api/settings',headers=self.headers,json={'automation_enabled':True,'setup_completed':True})
        executor = AsyncMock(return_value={'success':True,'message':'Test result'})
        for command in ['send hii to Mummy','Mummy ko hii bhejo','माँ को hii भेजो']:
            with patch.object(main,'execute_action',executor):
                response = self.client.post('/api/command/stream',headers=self.headers,json={'command':command})
            event = [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith('data: ')][-1]
            self.assertEqual(event['type'],'done')
            action = executor.call_args.args[0]
            self.assertEqual((action.target,action.message,action.control),('+919876543210','hii','Test Mother'))


if __name__ == '__main__': unittest.main()
