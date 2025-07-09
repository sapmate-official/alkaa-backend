/**
 * PDF Generation Configuration
 */
export const PDFConfig = {
    // Default PDF format ('html' or 'pdfkit')
    defaultFormat: 'html',
    
    // Puppeteer configuration
    puppeteer: {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
        timeout: 30000
    },
    
    // PDF generation options
    pdfOptions: {
        format: 'A4',
        printBackground: true,
        margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px'
        },
        preferCSSPageSize: true
    },
    
    // html-pdf configuration (alternative)
    htmlPdf: {
        format: 'A4',
        orientation: 'portrait',
        border: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px'
        },
        type: 'pdf',
        quality: '75',
        renderDelay: 1000,
        timeout: 30000
    },
    
    // Template configuration
    template: {
        // Company logo URL (can be local file path or URL)
        logoUrl: process.env.COMPANY_LOGO_URL || null,
        
        // Default company info (fallbacks)
        defaultCompany: {
            name: 'Your Company Name',
            address: 'Company Address',
            email: 'hr@company.com',
            phone: 'Company Phone'
        },
        
        // Color scheme
        colors: {
            primary: '#3b82f6',
            secondary: '#10b981',
            accent: '#f59e0b',
            text: '#1f2937',
            muted: '#6b7280'
        }
    }
};

/**
 * Environment-specific overrides
 */
if (process.env.NODE_ENV === 'production') {
    // Production optimizations
    PDFConfig.puppeteer.args.push('--disable-extensions');
    PDFConfig.puppeteer.timeout = 60000;
}

if (process.env.NODE_ENV === 'development') {
    // Development settings
    PDFConfig.puppeteer.headless = false; // Set to true in production
}
