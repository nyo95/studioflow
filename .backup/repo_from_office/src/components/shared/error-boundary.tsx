"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary [${this.props.name || "Unknown"}]:`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center animate-in fade-in duration-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 m-4">
          <div className="h-20 w-20 rounded-full bg-rose-50 flex items-center justify-center mb-6 shadow-sm border border-rose-100">
            <AlertCircle className="h-10 w-10 text-rose-500" />
          </div>
          
          <h2 className="font-lora text-2xl text-slate-900 mb-2 font-semibold">
            Something went wrong
          </h2>
          
          <p className="text-sm text-slate-500 font-inter font-medium tracking-tight mb-8 max-w-md mx-auto">
            {this.props.name ? `The ${this.props.name} extension` : "This component"} encountered an unexpected error. Don't worry, your data is safe.
          </p>

          <div className="flex items-center gap-3">
            <Button 
              onClick={this.handleReset}
              variant="outline"
              className="font-inter font-bold text-xs uppercase tracking-widest px-6 h-11 border-slate-200 hover:bg-white hover:border-slate-900 transition-all rounded-xl"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            
            <Button 
              onClick={this.handleGoHome}
              variant="default"
              className="font-inter font-bold text-xs uppercase tracking-widest px-6 h-11 bg-slate-900 hover:bg-slate-800 transition-all rounded-xl shadow-lg shadow-slate-200"
            >
              <Home className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>

          {process.env.NODE_ENV === "development" && this.state.error && (
            <div className="mt-12 p-4 bg-slate-100 rounded-xl text-left overflow-auto max-w-2xl w-full border border-slate-200">
              <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Debug Info</p>
              <pre className="text-xs text-rose-600 font-mono whitespace-pre-wrap break-all">
                {this.state.error.stack}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
