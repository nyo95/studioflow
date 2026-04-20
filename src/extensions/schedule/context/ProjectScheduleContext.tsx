"use client";

import * as React from "react";
import { ScheduleSection } from "@/generated/prisma";

interface ProjectScheduleContextType {
  projectId: string;
  category: string;
  section: ScheduleSection;
  onSuccess?: () => void;
}

const ProjectScheduleContext = React.createContext<ProjectScheduleContextType | null>(null);

interface ProjectScheduleProviderProps {
  value: ProjectScheduleContextType;
  children: React.ReactNode;
}

export function ProjectScheduleProvider({ value, children }: ProjectScheduleProviderProps) {
  return <ProjectScheduleContext.Provider value={value}>{children}</ProjectScheduleContext.Provider>;
}

export function useProjectScheduleContext() {
  const ctx = React.useContext(ProjectScheduleContext);
  if (!ctx) {
    throw new Error("useProjectScheduleContext must be used within ProjectScheduleProvider");
  }
  return ctx;
}