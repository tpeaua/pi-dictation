// swift-tools-version: 5.5
import PackageDescription

let package = Package(
    name: "dictation-helper",
    platforms: [
        .macOS(.v12)
    ],
    targets: [
        .executableTarget(
            name: "dictation-helper",
            path: "Sources"
        )
    ]
)
