#!/usr/bin/env python3

import requests
import sys

def test_api():
    """Simple test for the CV analysis API"""

    # Test health endpoint
    try:
        response = requests.get("http://localhost:8000/health")
        print("✓ Health check:", response.json())
    except Exception as e:
        print("✗ Health check failed:", str(e))
        return

    # Test root endpoint
    try:
        response = requests.get("http://localhost:8000/")
        print("✓ Root endpoint:", response.json())
    except Exception as e:
        print("✗ Root endpoint failed:", str(e))
        return

    print("\nAPI is running and ready for CV analysis!")
    print("To test CV analysis:")
    print("1. Upload a PDF file via the web interface")
    print("2. Or use curl:")
    print('curl -X POST "http://localhost:8000/api/analyze-cv" \\')
    print('  -F "file=@your_cv.pdf" \\')
    print('  -F "job_position=Data Analyst"')

if __name__ == "__main__":
    test_api()