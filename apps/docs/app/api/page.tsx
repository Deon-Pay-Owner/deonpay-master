import fs from 'fs';
import path from 'path';

export default function APIReferencePage() {
  const filePath = path.join(process.cwd(), '../api-worker/docs/openapi.json');
  const openapiSpec = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">
        API Reference
      </h1>

      <div className="bg-white rounded-lg shadow p-6 mb-8 border">
        <h2 className="text-2xl font-bold mb-4">{openapiSpec.info.title}</h2>
        <p className="text-gray-700 mb-4">{openapiSpec.info.description}</p>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Version: {openapiSpec.info.version}</span>
          <span>|</span>
          <span>OpenAPI {openapiSpec.openapi}</span>
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow p-6 border">
          <h3 className="text-xl font-bold mb-4">Base URL</h3>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-md">
            <code>{openapiSpec.servers[0].url}</code>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border">
          <h3 className="text-xl font-bold mb-4">Authentication</h3>
          <p className="text-gray-700 mb-2">Bearer token authentication</p>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-md">
            <code>Authorization: Bearer sk_test_...</code>
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Endpoints</h2>
          <div className="space-y-6">
            {Object.entries(openapiSpec.paths).map(([path, methods]: [string, any]) => (
              <div key={path} className="bg-white rounded-lg shadow p-6 border">
                <h3 className="text-xl font-mono font-bold mb-4 text-gray-900">{path}</h3>
                {Object.entries(methods).map(([method, details]: [string, any]) => (
                  <div key={method} className="mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded font-bold text-sm ${
                        method === 'get' ? 'bg-blue-100 text-blue-800' :
                        method === 'post' ? 'bg-green-100 text-green-800' :
                        method === 'put' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {method.toUpperCase()}
                      </span>
                      <span className="font-semibold text-gray-900">{details.summary}</span>
                    </div>
                    <p className="text-gray-600 text-sm ml-16">{details.description}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Schemas</h2>
          <div className="space-y-4">
            {Object.entries(openapiSpec.components.schemas).slice(0, 5).map(([name, schema]: [string, any]) => (
              <div key={name} className="bg-white rounded-lg shadow p-6 border">
                <h3 className="text-xl font-mono font-bold mb-2 text-gray-900">{name}</h3>
                <p className="text-gray-600 text-sm mb-4">Type: {schema.type}</p>
                {schema.required && (
                  <div className="text-sm">
                    <span className="font-semibold">Required fields: </span>
                    <span className="text-gray-700">{schema.required.join(', ')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-xl font-bold text-blue-900 mb-2">
            Complete API Specification
          </h3>
          <p className="text-blue-800 mb-4">
            Download the full OpenAPI 3.1 specification for import into tools like Postman, Insomnia, or Swagger UI.
          </p>
          <a
            href="/openapi.json"
            download
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Download OpenAPI Spec
          </a>
        </div>
      </div>
    </div>
  );
}
