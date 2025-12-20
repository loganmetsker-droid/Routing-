import VehicleMap from '../components/tracking/VehicleMap';

export default function TrackingPage() {
  return (
    <div className="h-screen w-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Vehicle Tracking</h1>
            <p className="text-sm text-gray-400 mt-1">
              Real-time vehicle location monitoring
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Map Container */}
      <main className="flex-1 relative">
        <VehicleMap />
      </main>
    </div>
  );
}
