using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

class R {
  static void Main(string[] args) {
    using (Image src = Image.FromFile(args[0])) {
      string dir = Path.GetDirectoryName(Path.GetFullPath(args[0]));
      for (int i = 1; i < args.Length; i++) {
        int size = int.Parse(args[i]);
        using (Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        using (Graphics g = Graphics.FromImage(bmp)) {
          g.CompositingQuality = CompositingQuality.HighQuality;
          g.InterpolationMode = InterpolationMode.HighQualityBicubic;
          g.SmoothingMode = SmoothingMode.HighQuality;
          g.PixelOffsetMode = PixelOffsetMode.HighQuality;
          g.DrawImage(src, 0, 0, size, size);
          bmp.Save(Path.Combine(dir, "icon-" + size + ".png"), ImageFormat.Png);
        }
      }
    }
  }
}
