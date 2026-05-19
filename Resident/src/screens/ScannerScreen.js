import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Image,
  ActivityIndicator,
  ScrollView,
  Animated,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useCameraPermissions, CameraView } from "expo-camera";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-react-native";
import { decodeJpeg } from "@tensorflow/tfjs-react-native";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import ScanResultCard from "../components/ScanResultCard";
import colors from "../constants/colors";
import { useAuth } from "../context/AuthContext";
import API_URL from "../config";

// ── ENHANCED TRASH CLASSIFICATION DATABASE ─────
const TRASH_CLASSES = {
  // Plastic Items
  bottle: {
    label: "Plastic Bottle",
    category: "Recyclable",
    binColor: "#2196F3",
    binType: "Blue Bin",
    tips: [
      "Rinse the bottle before recycling",
      "Remove and recycle cap separately",
      "Crush to save space in recycling bin",
    ],
  },
  cup: {
    label: "Disposable Cup",
    category: "Recyclable",
    binColor: "#2196F3",
    binType: "Blue Bin",
    tips: [
      "Remove plastic lid before recycling",
      "Empty all liquids first",
      "Paper cups with plastic lining may not be recyclable",
    ],
  },
  "plastic bag": {
    label: "Plastic Bag",
    category: "Recyclable",
    binColor: "#2196F3",
    binType: "Blue Bin",
    tips: [
      "Collect multiple bags together",
      "Take to grocery store recycling",
      "Consider using reusable bags instead",
    ],
  },

  // Glass Items
  "wine glass": {
    label: "Glass Item",
    category: "Recyclable",
    binColor: "#FFC107",
    binType: "Yellow Bin",
    tips: [
      "Rinse thoroughly before recycling",
      "Remove any metal or plastic parts",
      "Broken glass should be wrapped safely",
    ],
  },
  bottle_glass: {
    label: "Glass Bottle",
    category: "Recyclable",
    binColor: "#FFC107",
    binType: "Yellow Bin",
    tips: [
      "Remove metal caps before recycling",
      "Labels can stay on",
      "Different colors of glass may need separation",
    ],
  },

  // Metal Items
  can: {
    label: "Aluminum Can",
    category: "Recyclable",
    binColor: "#2196F3",
    binType: "Blue Bin",
    tips: [
      "Rinse out any residue",
      "Crush to save space",
      "Aluminum is infinitely recyclable!",
    ],
  },

  // Paper Items
  cardboard: {
    label: "Cardboard",
    category: "Recyclable",
    binColor: "#2196F3",
    binType: "Blue Bin",
    tips: [
      "Flatten boxes before recycling",
      "Remove tape and labels",
      "Keep dry - wet cardboard can't be recycled",
    ],
  },
  paper: {
    label: "Paper",
    category: "Recyclable",
    binColor: "#2196F3",
    binType: "Blue Bin",
    tips: [
      "Keep paper clean and dry",
      "Remove plastic windows from envelopes",
      "Shred sensitive documents first",
    ],
  },
  book: {
    label: "Book",
    category: "Recyclable",
    binColor: "#2196F3",
    binType: "Blue Bin",
    tips: [
      "Donate usable books to libraries",
      "Remove hardcover before recycling",
      "Consider book swapping programs",
    ],
  },
  newspaper: {
    label: "Newspaper",
    category: "Recyclable",
    binColor: "#2196F3",
    binType: "Blue Bin",
    tips: [
      "Stack neatly for recycling",
      "Keep away from moisture",
      "Can be used for composting too",
    ],
  },

  // Food Waste
  banana: {
    label: "Food Waste",
    category: "Compostable",
    binColor: "#4CAF50",
    binType: "Green Bin",
    tips: [
      "Great for home composting!",
      "Remove any stickers first",
      "Can be used as plant fertilizer",
    ],
  },
  apple: {
    label: "Food Waste",
    category: "Compostable",
    binColor: "#4CAF50",
    binType: "Green Bin",
    tips: [
      "Remove stickers before composting",
      "Core and all parts are compostable",
      "Adds valuable nutrients to compost",
    ],
  },
  orange: {
    label: "Food Waste",
    category: "Compostable",
    binColor: "#4CAF50",
    binType: "Green Bin",
    tips: [
      "Citrus peels are great for compost",
      "Cut into smaller pieces for faster breakdown",
      "Balances nitrogen in compost pile",
    ],
  },

  // Non-Recyclable Items
  fork: {
    label: "Plastic Utensil",
    category: "Non-Recyclable",
    binColor: "#9E9E9E",
    binType: "Trash Bin",
    tips: [
      "Cannot be recycled in most facilities",
      "Consider switching to reusable utensils",
      "Some specialized recyclers accept them",
    ],
  },
  knife: {
    label: "Plastic Utensil",
    category: "Non-Recyclable",
    binColor: "#9E9E9E",
    binType: "Trash Bin",
    tips: [
      "Plastic utensils are rarely recyclable",
      "Bamboo alternatives are eco-friendly",
      "Keep and reuse when possible",
    ],
  },
  spoon: {
    label: "Plastic Utensil",
    category: "Non-Recyclable",
    binColor: "#9E9E9E",
    binType: "Trash Bin",
    tips: [
      "Single-use plastics waste resources",
      "Carry a reusable spork instead",
      "Metal spoons last for decades",
    ],
  },

  // Electronics
  cellphone: {
    label: "Electronic Waste",
    category: "E-Waste",
    binColor: "#E91E63",
    binType: "Special Collection",
    tips: [
      "Never throw in regular trash!",
      "Take to e-waste recycling center",
      "Remove personal data first",
      "Many retailers offer trade-in programs",
    ],
  },
  laptop: {
    label: "Electronic Waste",
    category: "E-Waste",
    binColor: "#E91E63",
    binType: "Special Collection",
    tips: [
      "Contains hazardous materials",
      "Take to certified e-waste recycler",
      "Consider donating if still working",
      "Remove battery before recycling",
    ],
  },
};

// ── SIMPLIFIED WASTE DETECTION SYSTEM ──────────
class WasteDetectionSystem {
  constructor() {
    this.model = null;
    this.isReady = false;
  }

  async initialize() {
    try {
      console.log("🔄 Initializing Waste Detection System...");

      // Load COCO-SSD model
      this.model = await cocoSsd.load({
        base: "mobilenet_v2",
      });

      this.isReady = true;
      console.log("✅ Waste Detection System ready!");
    } catch (error) {
      console.error("❌ Failed to initialize:", error);
      throw new Error("Model initialization failed");
    }
  }

  async detectAndClassify(imageTensor) {
    if (!this.isReady) {
      throw new Error("Waste Detection System not initialized");
    }

    try {
      // Run detection
      const predictions = await this.model.detect(imageTensor);

      // Enhance results with waste classification
      return this.enhanceResults(predictions);
    } catch (error) {
      console.error("Detection error:", error);
      throw error;
    }
  }

  enhanceResults(detections) {
    // Filter and enhance detections
    const enhancedDetections = detections
      .filter((det) => det.score > 0.4) // Confidence threshold
      .map((det) => {
        const className = det.class.toLowerCase();
        const trashInfo = this.getClassInfo(className);
        return {
          ...trashInfo,
          confidence: Math.round(det.score * 100),
          bbox: det.bbox,
          className: className,
        };
      });

    // Sort by confidence
    return enhancedDetections.sort((a, b) => b.confidence - a.confidence);
  }

  getClassInfo(className) {
    // Direct match
    if (TRASH_CLASSES[className]) {
      return TRASH_CLASSES[className];
    }

    // Fuzzy matching based on keywords
    if (className.includes("bottle") || className.includes("cup")) {
      return (
        TRASH_CLASSES["bottle"] || {
          label: "Container",
          category: "Recyclable",
          binColor: "#2196F3",
          binType: "Blue Bin",
          tips: ["Check for recycling symbol", "Clean before recycling"],
        }
      );
    }

    if (className.includes("glass") || className.includes("jar")) {
      return (
        TRASH_CLASSES["wine glass"] || {
          label: "Glass Item",
          category: "Recyclable",
          binColor: "#FFC107",
          binType: "Yellow Bin",
          tips: ["Handle with care", "Rinse before recycling"],
        }
      );
    }

    if (
      className.includes("paper") ||
      className.includes("cardboard") ||
      className.includes("book")
    ) {
      return (
        TRASH_CLASSES["cardboard"] || {
          label: "Paper Product",
          category: "Recyclable",
          binColor: "#2196F3",
          binType: "Blue Bin",
          tips: ["Keep dry", "Flatten boxes"],
        }
      );
    }

    if (
      className.includes("banana") ||
      className.includes("apple") ||
      className.includes("orange") ||
      className.includes("food") ||
      className.includes("fruit") ||
      className.includes("vegetable")
    ) {
      return (
        TRASH_CLASSES["banana"] || {
          label: "Food Waste",
          category: "Compostable",
          binColor: "#4CAF50",
          binType: "Green Bin",
          tips: ["Great for composting!", "Remove packaging first"],
        }
      );
    }

    if (
      className.includes("fork") ||
      className.includes("knife") ||
      className.includes("spoon")
    ) {
      return (
        TRASH_CLASSES["fork"] || {
          label: "Utensil",
          category: "Non-Recyclable",
          binColor: "#9E9E9E",
          binType: "Trash Bin",
          tips: ["Consider reusable alternatives"],
        }
      );
    }

    if (
      className.includes("phone") ||
      className.includes("laptop") ||
      className.includes("electronic") ||
      className.includes("device")
    ) {
      return (
        TRASH_CLASSES["cellphone"] || {
          label: "Electronic Item",
          category: "E-Waste",
          binColor: "#E91E63",
          binType: "Special Collection",
          tips: ["Do not trash!", "Find e-waste recycler"],
        }
      );
    }

    // Default unknown
    return {
      label: this.formatLabel(className),
      category: "Uncertain",
      binColor: "#607D8B",
      binType: "Check Local Guidelines",
      tips: [
        "Consult local recycling guidelines",
        "When in doubt, throw it out",
        "Consider reducing consumption",
      ],
    };
  }

  formatLabel(className) {
    // Convert class name to readable format
    return className
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}

// ── ECO SCORE CALCULATOR ────────────────────────
function calculateEnvironmentalImpact(detection) {
  if (!detection) return { score: 0, grade: "N/A", color: "#9E9E9E" };

  let score = 0;

  // Base score from confidence
  score += (detection.confidence / 100) * 40;

  // Category bonuses
  const categoryScores = {
    Recyclable: 30,
    Compostable: 35,
    "E-Waste": 20,
    "Non-Recyclable": 5,
  };

  score += categoryScores[detection.category] || 0;

  // Cap the score
  score = Math.min(100, Math.max(0, Math.round(score)));

  // Determine grade
  let grade, color;
  if (score >= 80) {
    grade = "A";
    color = "#4CAF50";
  } else if (score >= 60) {
    grade = "B";
    color = "#8BC34A";
  } else if (score >= 40) {
    grade = "C";
    color = "#FFC107";
  } else if (score >= 20) {
    grade = "D";
    color = "#FF9800";
  } else {
    grade = "F";
    color = "#F44336";
  }

  return { score, grade, color };
}

// ── SCREEN DIMENSIONS ──────────────────────────
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── MAIN COMPONENT ─────────────────────────────
export default function ScannerScreen() {
  const { user } = useAuth();
  // State management
  const [permissionMessage, setPermissionMessage] = useState(
    "Checking camera permission...",
  );
  const cameraRef = useRef(null);
  const isFocused = useIsFocused();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [detectionSystem, setDetectionSystem] = useState(null);
  const [systemReady, setSystemReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [ecoImpact, setEcoImpact] = useState(null);
  const [allDetections, setAllDetections] = useState([]);
  const [photoUri, setPhotoUri] = useState(null);
  const [photoDimensions, setPhotoDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [showResults, setShowResults] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const hasPermission = cameraPermission?.status === "granted";

  // ── INITIALIZE SYSTEM ────────────────────────
  useEffect(() => {
    initializeDetectionSystem();
  }, []);

  const initializeDetectionSystem = async () => {
    try {
      await tf.ready();
      console.log("TensorFlow.js is ready");

      const system = new WasteDetectionSystem();
      await system.initialize();

      setDetectionSystem(system);
      setSystemReady(true);
      console.log("🎉 System fully initialized!");
    } catch (error) {
      console.error("Initialization error:", error);
      Alert.alert(
        "Setup Failed",
        "Could not initialize waste detection system. Please restart the app.",
        [{ text: "OK" }],
      );
    }
  };

  // ── PERMISSION HANDLING ──────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!hasPermission && cameraPermission?.status !== "granted") {
        setPermissionMessage("Camera permission is required");
      }
    }, [hasPermission, cameraPermission?.status]),
  );

  const handleRequestPermission = async () => {
    try {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        setPermissionMessage("Camera permission denied. Enable in settings");
      } else {
        setPermissionMessage("Camera access granted!");
      }
    } catch (error) {
      console.error("Permission error:", error);
    }
  };

  // ── IMAGE PROCESSING ─────────────────────────
  const imageToTensor = async (uri) => {
    try {
      const response = await fetch(uri);
      if (!response.ok) throw new Error("Failed to fetch image");

      const arrayBuffer = await response.arrayBuffer();
      const imageData = new Uint8Array(arrayBuffer);
      const tensor = decodeJpeg(imageData);
      return tensor;
    } catch (error) {
      console.error("Image conversion error:", error);
      throw error;
    }
  };

  // ── MAIN SCAN FUNCTION ───────────────────────
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || !detectionSystem || !systemReady) {
      Alert.alert(
        "Not Ready",
        "The waste detection system is still initializing.",
      );
      return;
    }

    try {
      setIsProcessing(true);
      setShowResults(false);

      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        base64: false,
        quality: 0.8,
      });

      // Get image dimensions
      const { width, height } = await new Promise((resolve, reject) => {
        Image.getSize(
          photo.uri,
          (w, h) => resolve({ width: w, height: h }),
          reject,
        );
      });

      // Convert to tensor
      const imageTensor = await imageToTensor(photo.uri);

      // Run waste detection
      const results = await detectionSystem.detectAndClassify(imageTensor);

      // Clean up tensor
      tf.dispose(imageTensor);

      // Process results
      if (results.length > 0) {
        const topResult = results[0];
        setDetectionResult(topResult);
        setAllDetections(results);
        setEcoImpact(calculateEnvironmentalImpact(topResult));
        // Award +5 points for a successful scan
        const uid = user?.id || user?._id;
        if (uid && topResult.label !== 'No Item Detected') {
          fetch(`${API_URL}/api/residents/${uid}/award-scan-points`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: topResult.label }),
          }).catch(() => {});
        }
      } else {
        setDetectionResult({
          label: "No Item Detected",
          category: "Unknown",
          binColor: "#9E9E9E",
          binType: "N/A",
          tips: [
            "Try getting closer to the item",
            "Ensure good lighting conditions",
            "Center the item in the viewfinder",
          ],
          confidence: 0,
        });
        setEcoImpact(calculateEnvironmentalImpact(null));
      }

      // Update UI
      setPhotoUri(photo.uri);
      setPhotoDimensions({ width, height });
      setShowResults(true);

      // Animate results
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error("Scan error:", error);
      Alert.alert(
        "Scan Failed",
        "Unable to process the image. Please try again.",
      );
    } finally {
      setIsProcessing(false);
    }
  }, [detectionSystem, systemReady, fadeAnim]);

  // ── RESET SCAN ───────────────────────────────
  const resetScan = () => {
    setShowResults(false);
    setPhotoUri(null);
    setDetectionResult(null);
    setEcoImpact(null);
    setAllDetections([]);
    fadeAnim.setValue(0);
  };

  // ── LOADING STATE ────────────────────────────
  if (cameraPermission === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primaryGreen} />
          <Text style={styles.loadingText}>Initializing camera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── RESULTS VIEW ─────────────────────────────
  if (showResults && photoUri) {
    const containerWidth = SCREEN_WIDTH - 48; // Increased margins
    const containerHeight =
      (photoDimensions.height / photoDimensions.width) * containerWidth;

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* Header with proper spacing */}
          <View style={styles.resultsHeader}>
            <View style={styles.resultsHeaderLeft}>
              <Ionicons name="leaf" size={28} color={colors.primaryGreen} />
              <Text style={styles.resultsTitle}>Scan Results</Text>
            </View>
            <TouchableOpacity
              onPress={resetScan}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <Ionicons
                name="close-circle"
                size={32}
                color={colors.primaryGreen}
              />
            </TouchableOpacity>
          </View>

          {/* Image with Detection Boxes - Enhanced spacing */}
          <View style={styles.imageSection}>
            <View style={styles.imageLabelContainer}>
              <Ionicons name="image-outline" size={16} color="#666" />
              <Text style={styles.imageLabel}>Captured Image</Text>
            </View>
            <View
              style={[
                styles.imageContainer,
                { width: containerWidth, height: containerHeight },
              ]}
            >
              <Image
                source={{ uri: photoUri }}
                style={styles.capturedImage}
                resizeMode="contain"
              />
              {allDetections.map((detection, index) => (
                <View
                  key={index}
                  style={[
                    styles.boundingBox,
                    {
                      left:
                        (detection.bbox[0] / photoDimensions.width) *
                        containerWidth,
                      top:
                        (detection.bbox[1] / photoDimensions.height) *
                        containerHeight,
                      width:
                        (detection.bbox[2] / photoDimensions.width) *
                        containerWidth,
                      height:
                        (detection.bbox[3] / photoDimensions.height) *
                        containerHeight,
                      borderColor: detection.binColor,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.detectionLabel,
                      { backgroundColor: detection.binColor },
                    ]}
                  >
                    <Text style={styles.detectionLabelText}>
                      {detection.label} ({detection.confidence}%)
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Eco Score Card - Enhanced with proper spacing */}
          {ecoImpact && (
            <Animated.View
              style={[
                styles.ecoCard,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.ecoCardHeader}>
                <View style={styles.ecoCardTitleRow}>
                  <Ionicons name="earth" size={22} color="#4CAF50" />
                  <Text style={styles.ecoCardTitle}>Environmental Impact</Text>
                </View>
                <View
                  style={[
                    styles.ecoBadge,
                    { backgroundColor: `${ecoImpact.color}15` },
                  ]}
                >
                  <Text
                    style={[styles.ecoBadgeText, { color: ecoImpact.color }]}
                  >
                    {ecoImpact.score >= 60 ? "🌍 Good" : "⚠️ Poor"}
                  </Text>
                </View>
              </View>

              <View style={styles.ecoScoreRow}>
                <View
                  style={[
                    styles.ecoScoreCircle,
                    { borderColor: ecoImpact.color },
                  ]}
                >
                  <Text style={[styles.ecoGrade, { color: ecoImpact.color }]}>
                    {ecoImpact.grade}
                  </Text>
                </View>

                <View style={styles.ecoScoreInfo}>
                  <Text style={styles.ecoScoreLabel}>Recyclability Score</Text>
                  <Text style={styles.ecoScoreValue}>
                    {ecoImpact.score}/100
                  </Text>
                  <View style={styles.ecoProgressBar}>
                    <View
                      style={[
                        styles.ecoProgressFill,
                        {
                          width: `${ecoImpact.score}%`,
                          backgroundColor: ecoImpact.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.ecoScoreHint}>
                    {ecoImpact.score >= 80
                      ? "Excellent! This item is highly recyclable"
                      : ecoImpact.score >= 60
                        ? "Good! This item can be recycled"
                        : ecoImpact.score >= 40
                          ? "Fair. Check local guidelines"
                          : "Consider alternatives to reduce waste"}
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Detection Result Card with proper spacing */}
          <View style={styles.resultCardSection}>
            <View style={styles.sectionLabel}>
              <Ionicons name="analytics-outline" size={16} color="#666" />
              <Text style={styles.sectionLabelText}>Classification Result</Text>
            </View>
            {detectionResult && (
              <ScanResultCard
                itemName={detectionResult.label}
                category={`${detectionResult.category} - ${detectionResult.binType}`}
                binColor={detectionResult.binColor}
                confidence={detectionResult.confidence}
                tips={detectionResult.tips}
              />
            )}
          </View>

          {/* Action Buttons with enhanced spacing */}
          <View style={styles.actionButtonsSection}>
            <TouchableOpacity
              style={[styles.actionButton, styles.scanAgainBtn]}
              onPress={resetScan}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-reverse" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>Scan Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.learnMoreBtn]}
              onPress={() =>
                Alert.alert(
                  "Recycling Tips",
                  "Always check your local recycling guidelines for the most accurate disposal information.",
                )
              }
              activeOpacity={0.8}
            >
              <Ionicons name="information-circle" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>Learn More</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom spacing for scroll */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── SCANNER VIEW ─────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Permission Banner */}
      {!hasPermission && (
        <View style={styles.permissionBanner}>
          <Ionicons name="warning" size={24} color="#856404" />
          <Text style={styles.permissionText}>{permissionMessage}</Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={handleRequestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Camera View */}
      {hasPermission && isFocused ? (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.cameraView}
            ref={cameraRef}
            facing="back"
            mode="picture"
          />
          {/* Camera Overlay */}
          <View style={styles.cameraOverlay}>
            <View style={styles.overlayBackground} />
            <View style={styles.overlayRow}>
              <View style={styles.overlayBackground} />
              <View style={styles.viewfinder}>
                {/* Corner markers */}
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />

                {/* Viewfinder text */}
                <View style={styles.viewfinderContent}>
                  {isProcessing ? (
                    <>
                      <ActivityIndicator size="large" color="#fff" />
                      <Text style={styles.viewfinderText}>
                        Analyzing waste...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="scan" size={40} color="#fff" />
                      <Text style={styles.viewfinderText}>
                        Point camera at waste item
                      </Text>
                      <Text style={styles.viewfinderSubtext}>
                        Position item within the frame
                      </Text>
                    </>
                  )}
                </View>
              </View>
              <View style={styles.overlayBackground} />
            </View>
            <View style={styles.overlayBackground} />
          </View>
        </View>
      ) : (
        /* Camera Placeholder */
        <View style={styles.cameraPlaceholder}>
          <View style={styles.placeholderContent}>
            <Ionicons name="camera-outline" size={64} color="#666" />
            <Text style={styles.placeholderText}>
              {hasPermission
                ? "Camera preview unavailable"
                : "Camera access required"}
            </Text>
          </View>
        </View>
      )}

      {/* Capture Button */}
      <View style={styles.captureContainer}>
        {!systemReady && hasPermission ? (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color={colors.primaryGreen} />
            <Text style={styles.loadingText}>Loading waste detector...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.captureButton,
              (!hasPermission || !systemReady || isProcessing) &&
                styles.captureButtonDisabled,
            ]}
            disabled={!hasPermission || !systemReady || isProcessing}
            onPress={handleCapture}
            activeOpacity={0.7}
          >
            <View style={styles.captureButtonInner}>
              <Ionicons
                name="camera"
                size={36}
                color={hasPermission && systemReady ? "#fff" : colors.greyedOut}
              />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Status Card */}
      <View style={styles.statusCardContainer}>
        <ScanResultCard
          itemName="Ready to Scan"
          category="Point camera at waste item and press capture"
          binColor={colors.primaryGreen}
        />
      </View>
    </SafeAreaView>
  );
}

// ── ENHANCED STYLES WITH PROPER SPACING ────────
const styles = StyleSheet.create({
  // Layout
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  bottomSpacer: {
    height: 20,
  },

  // Loading
  loadingText: {
    fontSize: 16,
    color: colors.primaryGreen,
    marginTop: 16,
    textAlign: "center",
  },
  loadingIndicator: {
    alignItems: "center",
    padding: 16,
  },

  // Permission Banner
  permissionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3CD",
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FFE69C",
  },
  permissionText: {
    flex: 1,
    color: "#856404",
    fontSize: 14,
    marginLeft: 12,
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: colors.primaryGreen,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginLeft: 12,
  },
  permissionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  // Camera
  cameraContainer: {
    width: "100%",
    height: SCREEN_HEIGHT * 0.55,
    position: "relative",
    backgroundColor: "#000",
  },
  cameraView: {
    width: "100%",
    height: "100%",
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  overlayBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  overlayRow: {
    flexDirection: "row",
    height: 280,
  },
  viewfinder: {
    width: 280,
    height: 280,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  viewfinderContent: {
    alignItems: "center",
    padding: 24,
  },
  viewfinderText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
  },
  viewfinderSubtext: {
    color: "#CCCCCC",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },

  // Corner Markers
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: colors.primaryGreen,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },

  // Camera Placeholder
  cameraPlaceholder: {
    width: "100%",
    height: SCREEN_HEIGHT * 0.55,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderContent: {
    alignItems: "center",
    padding: 24,
  },
  placeholderText: {
    color: "#666",
    fontSize: 16,
    marginTop: 20,
    textAlign: "center",
    lineHeight: 24,
  },

  // Capture Button
  captureContainer: {
    alignItems: "center",
    marginVertical: 24,
    paddingHorizontal: 24,
  },
  captureButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primaryGreen,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  captureButtonInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },

  // Status Card Container
  statusCardContainer: {
    marginTop: 8,
  },

  // ── RESULTS VIEW ENHANCED STYLES ─────────────

  // Results Header
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 4,
  },
  resultsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  resultsTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.primaryGreen,
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
  },

  // Image Section
  imageSection: {
    marginBottom: 24,
  },
  imageLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
    gap: 8,
  },
  imageLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  imageContainer: {
    position: "relative",
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#e0e0e0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  capturedImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },

  // Bounding Boxes
  boundingBox: {
    position: "absolute",
    borderWidth: 3,
    borderRadius: 8,
    borderStyle: "solid",
  },
  detectionLabel: {
    position: "absolute",
    top: -30,
    left: -2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detectionLabelText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Eco Score Card
  ecoCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  ecoCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  ecoCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ecoCardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  ecoBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  ecoBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  ecoScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  ecoScoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  ecoGrade: {
    fontSize: 32,
    fontWeight: "800",
  },
  ecoScoreInfo: {
    flex: 1,
  },
  ecoScoreLabel: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  ecoScoreValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 12,
  },
  ecoProgressBar: {
    width: "100%",
    height: 10,
    backgroundColor: "#E8E8E8",
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 10,
  },
  ecoProgressFill: {
    height: "100%",
    borderRadius: 5,
  },
  ecoScoreHint: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic",
    lineHeight: 18,
  },

  // Result Card Section
  resultCardSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  sectionLabelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Action Buttons
  actionButtonsSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  scanAgainBtn: {
    backgroundColor: colors.primaryGreen,
  },
  learnMoreBtn: {
    backgroundColor: "#2196F3",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
