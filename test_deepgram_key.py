#!/usr/bin/env python3
"""Test Deepgram API key validity"""

import requests
import json

# Your API key
API_KEY = "d842461f78b355681dcd992171b7b8c1db76f5f9"

# Test the key with Deepgram's REST API
url = "https://api.deepgram.com/v1/projects"
headers = {
    "Authorization": f"Token {API_KEY}",
    "Content-Type": "application/json"
}

print("Testing Deepgram API key...")
print(f"Key: {API_KEY[:8]}...{API_KEY[-4:]}")

try:
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        print("✅ API key is VALID!")
        projects = response.json()
        print(f"Found {len(projects.get('projects', []))} project(s)")
        for project in projects.get('projects', []):
            print(f"  - Project: {project.get('name')} (ID: {project.get('project_id')})")
    elif response.status_code == 401:
        print("❌ API key is INVALID or EXPIRED")
        print(f"Response: {response.text}")
    else:
        print(f"❌ Unexpected response: {response.status_code}")
        print(f"Response: {response.text}")
        
except Exception as e:
    print(f"❌ Error testing API key: {e}")

# Also test WebSocket endpoint
print("\nTesting WebSocket endpoint...")
ws_url = f"wss://api.deepgram.com/v1/listen?token={API_KEY}&model=nova-2"
print(f"URL: wss://api.deepgram.com/v1/listen?token={API_KEY[:8]}...&model=nova-2")
print("\nNote: Full WebSocket test requires audio streaming.")
print("If the API key is valid above, it should work for WebSocket too.")