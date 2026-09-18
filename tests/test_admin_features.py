import unittest

from app import app


class AdminFeatureTests(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()

    def test_admin_login_and_announcement_post(self):
        login_response = self.client.post(
            '/admin/login',
            data={'username': 'admin', 'password': 'admin123'},
            follow_redirects=True,
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertIn(b'Admin Dashboard', login_response.data)

        post_response = self.client.post(
            '/admin/announcement',
            data={
                'title': 'Hackathon',
                'body': 'Campus innovation challenge for all students.',
                'link': 'https://example.com/register',
                'event_date': '2026-10-25',
                'category': 'Hackathon',
            },
            follow_redirects=True,
        )
        self.assertEqual(post_response.status_code, 200)
        self.assertIn(b'Hackathon', post_response.data)

    def test_invalid_event_is_rejected(self):
        self.client.post(
            '/admin/login',
            data={'username': 'admin', 'password': 'admin123'},
        )
        response = self.client.post(
            '/admin/announcement',
            data={
                'title': '',
                'body': 'Missing title and invalid link.',
                'link': 'not-a-url',
                'event_date': '',
                'category': '',
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn(b'Event title is required.', response.data)
        self.assertIn(b'Registration link must be a valid', response.data)

    def test_admin_requires_login(self):
        response = self.client.get('/admin/dashboard')
        self.assertEqual(response.status_code, 302)


if __name__ == '__main__':
    unittest.main()
