"use client";

import { useEffect, useState } from "react";
import Header from "./Header";

export default function HeaderClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <Header />;
}