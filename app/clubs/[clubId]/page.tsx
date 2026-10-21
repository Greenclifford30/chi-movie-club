"use client";
import { useParams } from "next/navigation";
import { MovieNightList } from "@/components/movie-club/movie-night-list";
export default function ClubSchedulePage() {
  const { clubId } = useParams<{ clubId: string }>();
  return <MovieNightList key={clubId} clubId={clubId} />;
}
