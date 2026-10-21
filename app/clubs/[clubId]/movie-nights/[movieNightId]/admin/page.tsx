"use client";
import { useParams } from "next/navigation";
import EventAdmin from "../../../admin/admin-client";
export default function MovieNightPage() {
  const { clubId, movieNightId } = useParams<{ clubId: string; movieNightId: string }>();
  return <EventAdmin key={`${clubId}:${movieNightId}`} />;
}
