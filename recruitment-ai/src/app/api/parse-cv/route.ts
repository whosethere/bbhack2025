import { NextRequest, NextResponse } from "next/server";

// Python API response format
interface PythonCVResponse {
  imie_nazwisko: string;
  numer_telefonu: string | null;
  email: string;
  miasto: string;
  lista_technologii: string[];
  wyksztalcenie: "wyzsze" | "inne";
  ile_lat_doswiadczenia: number;
  lista_umiejetnosci_miekkich: string[];
}

// Our app's expected format
interface CVData {
  fullName: string;
  email: string;
  phone: string;
  github: string;
  languages: string[];
  technologies: string[];
  experience: string;
  education: string;
}

function convertPythonResponseToAppFormat(pythonData: PythonCVResponse): CVData {
  return {
    fullName: pythonData.imie_nazwisko || "",
    email: pythonData.email || "",
    phone: pythonData.numer_telefonu || "",
    github: "", // Not provided by Python API
    languages: pythonData.lista_umiejetnosci_miekkich || [], // Using soft skills as languages fallback
    technologies: pythonData.lista_technologii || [],
    experience: `${pythonData.ile_lat_doswiadczenia} lat doświadczenia`,
    education: pythonData.wyksztalcenie === "wyzsze" ? "Wykształcenie wyższe" : "Inne wykształcenie"
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Only accept PDF files for Python API
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Prepare form data for Python API
    const pythonFormData = new FormData();
    pythonFormData.append("file", file);
    pythonFormData.append("job_position", "General"); // Default position

    // Call Python API
    const pythonApiUrl = process.env.PYTHON_CV_API_URL || "http://localhost:8000";
    const response = await fetch(`${pythonApiUrl}/api/analyze-cv`, {
      method: "POST",
      body: pythonFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Python API error:", errorText);
      throw new Error(`Python API failed: ${response.status} - ${errorText}`);
    }

    const pythonResult = await response.json();

    if (!pythonResult.success) {
      throw new Error(pythonResult.error || "Python API returned error");
    }

    // Convert Python API response to our app format
    const appData = convertPythonResponseToAppFormat(pythonResult.data);

    return NextResponse.json({
      success: true,
      data: appData,
      pythonResponse: pythonResult.data // Keep original for debugging
    });

  } catch (error) {
    console.error("CV parsing error:", error);
    return NextResponse.json(
      {
        error: "Failed to parse CV",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}