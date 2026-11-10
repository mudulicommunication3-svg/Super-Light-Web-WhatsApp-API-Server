import React from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  ShieldCheck,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Building2,
  ExternalLink
} from 'lucide-react';

export const PaymentPolicyModal: React.FC = () => {
  const { showPaymentPolicyModal, setShowPaymentPolicyModal, isEnglish } = useApp();

  if (!showPaymentPolicyModal) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-policy-title"
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={() => setShowPaymentPolicyModal(false)}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 id="payment-policy-title" className="text-base sm:text-lg font-black leading-tight text-white">
                {isEnglish ? 'Payment & Refund Policy' : 'ପେମେଣ୍ଟ୍ ଓ ରିଫଣ୍ଡ୍ ନିୟମାବଳୀ'}
              </h2>
              <p className="text-xs text-emerald-100 font-medium">
                Munna Grocery • Niali, Cuttack
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowPaymentPolicyModal(false)}
            aria-label="Close Payment Policy Modal"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-700 text-xs sm:text-sm">
          {/* Store Identification & Merchant Manifest */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-black text-xs uppercase tracking-wider">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>{isEnglish ? 'Store Identification & Merchant Details' : 'ଦୋକାନ ପରିଚୟ ଓ ଠିକଣା ବିବରଣୀ'}</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-600 font-medium">
              <p>
                <strong className="text-slate-900 font-bold">{isEnglish ? 'Business Name:' : 'ବ୍ୟବସାୟ ନାମ:'}</strong> Munna Grocery (ମୁନ୍ନା ଗ୍ରୋସରୀ)
              </p>
              <p className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-900 font-bold">{isEnglish ? 'Address:' : 'ଦୋକାନ ଠିକଣା:'}</strong> Cinema Hall Road, Niali, Cuttack, Odisha - 754004
                </span>
              </p>
              <p className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  <strong className="text-slate-900 font-bold">{isEnglish ? 'Helpline / Phone:' : 'ଗ୍ରାହକ ସେବା ଫୋନ୍:'}</strong> +91 9937150743
                </span>
              </p>
              <p className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  <strong className="text-slate-900 font-bold">{isEnglish ? 'Support Email:' : 'ସପୋର୍ଟ ଇମେଲ୍:'}</strong> grocerymuna@gmail.com
                </span>
              </p>
            </div>
          </div>

          {/* PhonePe / Google Pay / UPI Transaction Terms */}
          <div className="border border-emerald-100 bg-emerald-50/50 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-950 font-black text-xs uppercase tracking-wider">
              <CreditCard className="w-4 h-4 text-emerald-700" />
              <span>{isEnglish ? 'PhonePe, Google Pay & UPI Payment Terms' : 'PhonePe, Google Pay ଓ UPI ପେମେଣ୍ଟ୍ ନିୟମ'}</span>
            </div>

            <div className="space-y-2 text-xs text-slate-700 leading-relaxed font-medium">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 font-bold">
                    {isEnglish ? 'Accepted UPI Modes:' : 'ଗ୍ରହଣୀୟ UPI ମାଧ୍ୟମ:'}
                  </strong>{' '}
                  {isEnglish
                    ? 'PhonePe, Google Pay, Paytm, BHIM, and all NPCI-compliant UPI applications through Counter Dynamic QR and Online UPI payment.'
                    : 'PhonePe, Google Pay, Paytm, BHIM ଏବଂ ସମସ୍ତ ବ୍ୟାଙ୍କ୍ UPI ଆପ୍ (ଦୋକାନ QR କୋଡ୍ ଓ ଅନଲାଇନ୍ UPI) ଗ୍ରହଣ କରାଯାଏ।'}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 font-bold">
                    {isEnglish ? 'Payment Verification:' : 'ପେମେଣ୍ଟ୍ ନିଶ୍ଚିତକରଣ:'}
                  </strong>{' '}
                  {isEnglish
                    ? 'Orders paid via UPI are confirmed instantly with official UTR / Bank Reference ID matching.'
                    : 'UPI ମାଧ୍ୟମରେ ଦିଆଯାଇଥିବା ଟଙ୍କା ବ୍ୟାଙ୍କ UTR ନମ୍ବର / ରେଫରେନ୍ସ ID ଦ୍ୱାରା ତୁରନ୍ତ ଯାଞ୍ଚ ହୁଏ।'}
                </div>
              </div>

              {/* NPCI Failed/Deducted UPI Auto-Reversal */}
              <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-2.5 flex items-start gap-2 text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11.5px] leading-snug">
                  <strong className="font-extrabold block text-amber-900">
                    {isEnglish ? 'Failed / Deducted UPI Payments (NPCI Guidelines):' : 'ଟଙ୍କା କଟିଯାଇ ଅର୍ଡର ନହେଲେ (NPCI ନିୟମ):'}
                  </strong>
                  <span>
                    {isEnglish
                      ? 'If money is debited from your account due to a network glitch but the order is not confirmed, your issuing bank will automatically reverse the full amount to your account within 24 to 48 banking hours as per NPCI guidelines.'
                      : 'ଯଦି ନେଟୱାର୍କ ତ୍ରୁଟି କାରଣରୁ ଆପଣଙ୍କ ବ୍ୟାଙ୍କ ଆକାଉଣ୍ଟରୁ ଟଙ୍କା କଟିଯାଏ କିନ୍ତୁ ଅର୍ଡର ନିଶ୍ଚିତ ନହୁଏ, ତେବେ NPCI ନିୟମ ଅନୁସାରେ ଆପଣଙ୍କ ବ୍ୟାଙ୍କ ୨୪ ରୁ ୪୮ ଘଣ୍ଟା ମଧ୍ୟରେ ସମସ୍ତ ଟଙ୍କା ଫେରସ୍ତ (Auto-Reverse) କରିଦିଏ।'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cancellation & Refund Policy */}
          <div className="border border-slate-200 rounded-2xl p-3.5 space-y-2.5 bg-white">
            <div className="flex items-center gap-2 text-slate-900 font-black text-xs uppercase tracking-wider">
              <RotateCcw className="w-4 h-4 text-[#1864ab]" />
              <span>{isEnglish ? 'Cancellation & Refund Policy' : 'ବାତିଲ୍ (Cancellation) ଓ ରିଫଣ୍ଡ୍ ନିୟମ'}</span>
            </div>

            <div className="space-y-2 text-xs text-slate-600 leading-relaxed font-medium">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#1864ab] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 font-bold">
                    {isEnglish ? 'Order Cancellation Window:' : 'ଅର୍ଡର ବାତିଲ୍ ସମୟସୀମା:'}
                  </strong>{' '}
                  {isEnglish
                    ? 'Orders can be cancelled free of charge before the store moves the order to "Packing" or "Out for Delivery" status.'
                    : 'ଅର୍ଡର ପ୍ୟାକିଂ ବା ଡେଲିଭରୀ ପାଇଁ ବାହାରିବା ପୂର୍ବରୁ ଆପଣ ମାଗଣାରେ ବାତିଲ୍ କରିପାରିବେ।'}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <RotateCcw className="w-4 h-4 text-[#1864ab] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 font-bold">
                    {isEnglish ? 'Quality Issue / Missing Items Resolution:' : 'ଗୁଣବତ୍ତା ବା ସାମଗ୍ରୀ ତ୍ରୁଟି ରିଫଣ୍ଡ୍:'}
                  </strong>{' '}
                  {isEnglish
                    ? 'In the rare event of quality issues, damaged goods, or missing items at delivery or counter pickup, immediate replacement or instant cash refund is provided at our Cinema Hall Road counter, or credited to your UPI account within 24 hours.'
                    : 'ସଉଦା ନେବା ବେଳେ କୌଣସି ସାମଗ୍ରୀ ଖରାପ ଥିଲେ ବା କମିଥିଲେ ଆମ ଦୋକାନ କାଉଣ୍ଟର (ସିନେମା ହଲ୍ ରୋଡ୍, ନିଆଳି) ରେ ତୁରନ୍ତ ବଦଳ ବା ନଗଦ ଟଙ୍କା ଫେରସ୍ତ କିମ୍ବା ୨୪ ଘଣ୍ଟା ମଧ୍ୟରେ UPI ଆକାଉଣ୍ଟକୁ ଫେରସ୍ତ କରାଯିବ।'}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 font-bold">
                    {isEnglish ? 'Secure Transactions Guarantee:' : 'ସୁରକ୍ଷିତ କାରବାର ନିଶ୍ଚିତତା:'}
                  </strong>{' '}
                  {isEnglish
                    ? '100% encrypted and verified merchant payments. We never store credit/debit card numbers or your secret UPI PIN.'
                    : '୧୦୦% ସୁରକ୍ଷିତ ଓ ଏନକ୍ରିପ୍ଟେଡ୍ ବ୍ୟବସାୟିକ କାରବାର। ଆମେ କେବେହେଲେ ଆପଣଙ୍କ UPI PIN ବା କାର୍ଡ ନମ୍ବର ସାଇତି ରଖୁନାହୁଁ।'}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Contact & Action Buttons */}
          <div className="bg-slate-100/80 rounded-2xl p-3 space-y-2">
            <p className="text-[11px] font-black text-slate-800 uppercase tracking-wide text-center">
              {isEnglish ? 'Need Help with a Payment or Order?' : 'ପେମେଣ୍ଟ୍ କିମ୍ବା ଅର୍ଡର ସହାୟତା ଆବଶ୍ୟକ କି?'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <a
                href="tel:9937150743"
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-transform active:scale-95"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{isEnglish ? 'Call Helpline' : 'କଲ୍ କରନ୍ତୁ'}</span>
              </a>

              <a
                href="mailto:grocerymuna@gmail.com"
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#1864ab] hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs transition-transform active:scale-95"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{isEnglish ? 'Send Email' : 'ଇମେଲ୍ କରନ୍ତୁ'}</span>
              </a>

              <a
                href="https://www.google.com/maps/search/?api=1&query=Cinema+Hall+Road+Niali+Cuttack+Odisha+754004"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black shadow-xs transition-transform active:scale-95"
              >
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span>{isEnglish ? 'Store Map' : 'ମ୍ୟାପ୍ ଦେଖନ୍ତୁ'}</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={() => setShowPaymentPolicyModal(false)}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95"
          >
            {isEnglish ? 'Close Policy (ବନ୍ଦ କରନ୍ତୁ)' : 'ବନ୍ଦ କରନ୍ତୁ (Close)'}
          </button>
        </div>
      </div>
    </div>
  );
};
