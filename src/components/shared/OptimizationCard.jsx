import React from 'react';
import { FileText, X, Check } from 'lucide-react';

const OptimizationCard = ({ optimization, onAccept, onReject, index }) => (
  <div className="bg-white/90 backdrop-blur rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300">
    <div className="flex justify-between items-center mb-4">
      <h4 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
        <FileText className="w-5 h-5 text-purple-600" />
        <span>{optimization.section.charAt(0).toUpperCase() + optimization.section.slice(1)}</span>
      </h4>
      <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
        OPTIMIZED
      </span>
    </div>
    
    <p className="text-gray-600 mb-4">
      <strong className="text-purple-600">Improvement:</strong> {optimization.explanation}
    </p>
    
    <div className="grid md:grid-cols-2 gap-4 mb-4">
      <div>
        <label className="text-sm font-semibold text-gray-700">Original:</label>
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
            {typeof optimization.original === 'string' 
              ? optimization.original 
              : JSON.stringify(optimization.original, null, 2)}
          </pre>
        </div>
      </div>
      <div>
        <label className="text-sm font-semibold text-gray-700">Optimized:</label>
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
            {typeof optimization.optimized === 'string' 
              ? optimization.optimized 
              : JSON.stringify(optimization.optimized, null, 2)}
          </pre>
        </div>
      </div>
    </div>
    
    <div className="flex justify-end space-x-3">
      <button
        onClick={() => onReject(index)}
        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
      >
        <X className="w-4 h-4 inline mr-1" /> Reject
      </button>
      <button
        onClick={() => onAccept(index)}
        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
      >
        <Check className="w-4 h-4 inline mr-1" /> Accept
      </button>
    </div>
  </div>
);

export default OptimizationCard;