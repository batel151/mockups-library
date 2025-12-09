import UploadForm from '@/components/UploadForm'

export default function UploadPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Upload New Asset</h2>
        <p className="text-slate-400">
          Add images, screenshots, or GIFs to your library
        </p>
      </div>

      <UploadForm />
    </div>
  )
}


