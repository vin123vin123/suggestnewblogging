@app.route('/', methods=['GET'])
def health_check():
    # 1. Fetch current data summary safely
    toy_list = []
    if db_connected and toys_collection is not None:
        try:
            toy_list = list(toys_collection.find({}, {"name": 1, "price": 1, "image_url": 1}))
        except Exception:
            pass

    # 2. Build a quick structural view block
    html_content = f"""
    <html>
        <head><title>Server Status & Data Audit</title></head>
        <body style="font-family: Arial, sans-serif; margin: 40px; background: #f9f9f9;">
            <h2>⚙️ Server Status</h2>
            <p><b>Database Connected:</b> {"✅ YES" if db_connected else "❌ NO"}</p>
            <p><b>Cloudinary Connected:</b> {"✅ YES" if CLOUDINARY_URL else "❌ NO"}</p>
            
            <hr style="margin: 20px 0;">
            
            <h2>🧸 Current Items in MongoDB ({len(toy_list)})</h2>
            <div style="display: flex; flex-wrap: wrap; gap: 15px;">
    """
    
    for toy in toy_list:
        img = toy.get('image_url', '')
        html_content += f"""
            <div style="background: white; border: 1px solid #ddd; padding: 15px; border-radius: 8px; width: 180px;">
                {f'<img src="{img}" style="width:100%; height:120px; object-fit:contain; border-radius:4px;">' if img else ''}
                <h4 style="margin: 10px 0 5px 0;">{toy.get('name', 'Unnamed')}</h4>
                <p style="color: #4CAF50; font-weight: bold; margin: 0;">${toy.get('price', 0.0)}</p>
            </div>
        """
        
    html_content += """
            </div>
        </body>
    </html>
    """
    return html_content, 200
