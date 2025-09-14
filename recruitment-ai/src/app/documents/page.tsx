"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { FileText, Download, User, Building2 } from "lucide-react";

interface Application {
  id: string;
  contract_generated: boolean;
  contract_content?: string;
  candidate: {
    full_name: string;
    email: string;
    phone?: string;
  };
  job_position: {
    title: string;
    department?: string;
  };
  decision_made_at: string;
}

export default function DocumentsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingContract, setGeneratingContract] = useState<string | null>(null);

  useEffect(() => {
    fetchOfferedApplications();
  }, []);

  const fetchOfferedApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          id,
          contract_generated,
          contract_content,
          decision_made_at,
          candidate:candidates(full_name, email, phone),
          job_position:job_positions(title, department)
        `)
        .eq('candidate_decision', 'offered')
        .order('decision_made_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateContract = async (app: Application) => {
    setGeneratingContract(app.id);

    try {
      const contractTemplate = `UMOWA O ZATRUDNIENIE

===========================================

Pracodawca: NextHire Sp. z o.o.
Adres: ul. Przykładowa 123, 00-001 Warszawa
NIP: 1234567890

Pracownik: ${app.candidate.full_name}
Email: ${app.candidate.email}
${app.candidate.phone ? `Telefon: ${app.candidate.phone}` : ''}

===========================================

WARUNKI ZATRUDNIENIA:

Stanowisko: ${app.job_position.title}
${app.job_position.department ? `Dział: ${app.job_position.department}` : ''}
Data rozpoczęcia pracy: ${new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('pl-PL')}
Miejsce wykonywania pracy: ul. Przykładowa 123, 00-001 Warszawa
Wymiar etatu: pełny etat
Rodzaj umowy: umowa o pracę na czas nieokreślony
Okres próbny: 3 miesiące

WYNAGRODZENIE:
Wynagrodzenie zasadnicze: 12,000 - 15,000 PLN brutto miesięcznie
Termin wypłaty: do 10 dnia następnego miesiąca

CZAS PRACY:
Standardowy czas pracy: 8 godzin dziennie, 40 godzin tygodniowo
Godziny pracy: 9:00 - 17:00 (elastyczne godziny pracy)
Urlop wypoczynkowy: zgodnie z Kodeksem Pracy

DODATKOWE ŚWIADCZENIA:
- Prywatna opieka medyczna
- Karta MultiSport
- Elastyczne godziny pracy
- Możliwość pracy zdalnej (hybrydowo)
- Budżet na szkolenia i rozwój zawodowy

OBOWIĄZKI PRACOWNIKA:
- Wykonywanie zadań zgodnie z opisem stanowiska
- Przestrzeganie regulaminu pracy
- Zachowanie poufności informacji służbowych
- Współpraca z zespołem

Data wygenerowania: ${new Date().toLocaleDateString('pl-PL')}

===========================================

Niniejsza umowa została wygenerowana automatycznie przez system NextHire.
Przed podpisaniem wymaga weryfikacji przez dział HR i prawny.

===========================================`;

      // Update database with generated contract
      const { error } = await supabase
        .from('applications')
        .update({
          contract_generated: true,
          contract_content: contractTemplate
        })
        .eq('id', app.id);

      if (error) throw error;

      // Refresh the applications list
      await fetchOfferedApplications();

      alert('✅ Umowa została wygenerowana pomyślnie!');
    } catch (error) {
      console.error('Error generating contract:', error);
      alert('❌ Błąd podczas generowania umowy');
    } finally {
      setGeneratingContract(null);
    }
  };

  const downloadContract = (app: Application) => {
    if (!app.contract_content) return;

    const blob = new Blob([app.contract_content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Umowa_${app.candidate.full_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Ładowanie dokumentów...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-gray-600">Zarządzanie umowami o zatrudnienie</p>
        </div>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Brak kandydatów z złożonymi ofertami</p>
            <p className="text-sm text-gray-400">Kandydaci z ofertami pojawią się tutaj automatycznie</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {applications.map((app) => (
            <Card key={app.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-blue-600" />
                    <div>
                      <div>{app.candidate.full_name}</div>
                      <div className="text-sm font-normal text-gray-600">
                        {app.job_position.title}
                        {app.job_position.department && ` • ${app.job_position.department}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {app.contract_generated ? (
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                        ✅ Umowa wygenerowana
                      </span>
                    ) : (
                      <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm">
                        ⏳ Oczekuje na umowę
                      </span>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <div>{app.candidate.email}</div>
                    </div>
                    {app.candidate.phone && (
                      <div>
                        <span className="text-gray-500">Telefon:</span>
                        <div>{app.candidate.phone}</div>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Oferta złożona:</span>
                      <div>{new Date(app.decision_made_at).toLocaleDateString('pl-PL')}</div>
                    </div>
                  </div>

                  {/* Contract Content Preview */}
                  {app.contract_content && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Podgląd umowy:</h4>
                      <div className="bg-gray-50 p-4 rounded border max-h-60 overflow-y-auto">
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                          {app.contract_content.substring(0, 500)}
                          {app.contract_content.length > 500 && '...\n\n[Treść została skrócona]'}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4 border-t">
                    {!app.contract_generated ? (
                      <Button
                        onClick={() => generateContract(app)}
                        disabled={generatingContract === app.id}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {generatingContract === app.id ? (
                          <>⏳ Generowanie...</>
                        ) : (
                          <>📋 Generuj umowę o zatrudnienie</>
                        )}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => downloadContract(app)}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Pobierz umowę (.txt)
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}