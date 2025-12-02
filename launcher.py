import os
import webbrowser

def open_html_file(filename="rapor.html"):
    # Dapatkan jalur absolut ke file HTML
    # Asumsikan file html berada di dalam sub-folder 'assets'
    html_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "Aplikasi Rapor", filename))
    
    # Periksa apakah file ada
    if os.path.exists(html_path):
        # Buka file di browser web default
        webbrowser.open(f"file://{html_path}")
        print(f"Membuka file: {html_path}")
    else:
        print(f"Error: File '{filename}' tidak ditemukan di {html_path}")

if __name__ == "__main__":
    # Ganti "index.html" dengan nama file HTML utama Anda jika berbeda
    open_html_file("rapor.html")
```