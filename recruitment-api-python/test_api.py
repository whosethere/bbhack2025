import requests
import json

# Test endpoint
BASE_URL = "http://localhost:8000"

def test_root():
    """Test if API is running"""
    response = requests.get(f"{BASE_URL}/")
    print("Root endpoint:", response.json())

def test_cv_analysis():
    """Test CV analysis endpoint"""
    # You'll need to have a test PDF file
    files = {
        'file': ('test_cv.pdf', open('test_cv.pdf', 'rb'), 'application/pdf')
    }
    data = {
        'job_position': 'Senior Python Developer',
        'requirements': 'Python, FastAPI, Machine Learning, 5+ years experience'
    }

    response = requests.post(
        f"{BASE_URL}/api/analyze-cv",
        files=files,
        data=data
    )

    print("CV Analysis Response:")
    print(json.dumps(response.json(), indent=2))

if __name__ == "__main__":
    test_root()
    # Uncomment when you have a test PDF
    # test_cv_analysis()