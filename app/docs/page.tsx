'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';
import { AppLayout } from '@/components/AppLayout';
import { swaggerSpec } from '@/lib/swagger-spec';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function DocsPage() {
  return (
    <AppLayout>
      <div className="flex-1 h-full overflow-y-auto bg-white p-6 font-sans">
        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Teader API Interactive Documentation (Swagger)</h1>
          <p className="text-sm text-gray-600 mb-6">
            Interactive OpenAPI 3.0 specification for Teader endpoints. Backed by MySQL (<code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-xs text-gray-800">teader_db</code>).
          </p>
          <SwaggerUI spec={swaggerSpec} />
        </div>
      </div>
    </AppLayout>
  );
}
