"use client";
import { useParams } from "next/navigation";
import EventDetail from "@/components/movie-club/event-detail";
export default function MovieNightPage() {
  const { clubId, movieNightId } = useParams<{ clubId: string; movieNightId: string }>();
  return <EventDetail key={`${clubId}:${movieNightId}`} />;
}
