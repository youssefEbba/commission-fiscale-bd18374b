import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import ProcessSection from "@/components/landing/ProcessSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import DocumentationSection from "@/components/landing/DocumentationSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <HeroSection />
    <ProcessSection />
    <FeaturesSection />
    <DocumentationSection />
    <CTASection />
    <Footer />
  </div>
);

export default Index;
