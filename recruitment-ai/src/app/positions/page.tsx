"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database";

type JobPosition = Database["public"]["Tables"]["job_positions"]["Row"];

export default function PositionsPage() {
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPositions();
  }, []);

  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase
        .from("job_positions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPositions(data || []);
    } catch (error) {
      console.error("Error fetching positions:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Ładowanie...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Stanowiska</h1>
        <Link href="/positions/new">
          <Button>➕ Dodaj stanowisko</Button>
        </Link>
      </div>

      {positions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500 mb-4">Brak aktywnych stanowisk</p>
            <Link href="/positions/new">
              <Button>Dodaj pierwsze stanowisko</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {positions.map((position) => (
            <Card key={position.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{position.title}</CardTitle>
                    <p className="text-sm text-gray-500">{position.department}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      position.status === "published"
                        ? "bg-green-100 text-green-800"
                        : position.status === "closed"
                        ? "bg-gray-100 text-gray-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {position.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4 line-clamp-2">{position.description}</p>
                <div className="flex gap-2">
                  <Link href={`/dashboard?position=${position.id}`}>
                    <Button variant="outline" size="sm">
                      📊 Zobacz kandydatów
                    </Button>
                  </Link>
                  <Link href={`/candidates/apply?position=${position.id}`}>
                    <Button size="sm">
                      📝 Aplikuj
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}