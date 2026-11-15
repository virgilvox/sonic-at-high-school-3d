// Reads image paths on stdin, prints one JSON line per image with recognized text lines and their boxes.
import Foundation
import Vision
import AppKit

func ocr(_ path: String) -> [[String: Any]] {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return [] }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = false
    req.recognitionLanguages = ["en-US"]
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
    var out: [[String: Any]] = []
    for o in req.results ?? [] {
        guard let c = o.topCandidates(1).first else { continue }
        let b = o.boundingBox
        out.append(["t": c.string, "c": c.confidence, "x": b.minX, "y": b.minY, "w": b.width, "h": b.height])
    }
    return out
}

while let line = readLine() {
    let p = line.trimmingCharacters(in: .whitespaces)
    if p.isEmpty { continue }
    let rec: [String: Any] = ["f": p, "o": ocr(p)]
    let data = try! JSONSerialization.data(withJSONObject: rec)
    print(String(data: data, encoding: .utf8)!)
    fflush(stdout)
}
