import { ref, readonly, onMounted, computed } from "vue";
import type { AppConfig } from "@/types";
import { useFileSystemAccess } from "./useFileSystemAccess";

const CONFIG_FILENAME = "config.json";
const isLoading = ref(false);
const error = ref<string | null>(null);

const defaultConfig: AppConfig = {
  dataDirectory: null, // Default to null, meaning not configured
  patientsFilename: "patients.json",
  notesBaseDir: "notes",
  theme: "light",
};

const config = ref<AppConfig>({ ...defaultConfig });
const isConfigLoaded = ref(false);
const dataDirectoryChangeFlag = ref(0); // Used to trigger reactivity on path change

export function useConfig() {
  const { joinPaths } = useFileSystemAccess();

  // Helper function to determine the correct config file path
  const getConfigPath = async (): Promise<string> => {
    if ((window as any).electronAPI.isProduction()) {
      const appPath = await window.electronAPI.getAppPath();
      return await joinPaths(appPath, "resources", CONFIG_FILENAME);
    } else {
      // Development: Load from public directory relative to project root
      return await joinPaths(".", "public", CONFIG_FILENAME);
    }
  };

  const readConfigFile = async (): Promise<AppConfig | null> => {
    try {
      const configPath = await getConfigPath();
      const fileContent = await window.electronAPI.readFileAbsolute(configPath);
      return fileContent ? JSON.parse(fileContent) : null;
    } catch (error: any) {
      console.error("Error reading config file:", error);
      return null;
    }
  };

  const writeConfigFile = async (configData: AppConfig): Promise<void> => {
    try {
      const configPath = await getConfigPath();
      await window.electronAPI.writeFileAbsolute(
        configPath,
        JSON.stringify(configData, null, 2)
      );
    } catch (error: any) {
      console.error("Error writing config file:", error);
      throw error; // Re-throw to be caught by caller
    }
  };

  const loadConfig = async () => {
    if (isConfigLoaded.value) return;
    isLoading.value = true;
    error.value = null;
    try {
      const loadedConfig = await readConfigFile();
      if (loadedConfig) {
        // Merge defaults with loaded config to handle missing properties
        config.value = { ...defaultConfig, ...loadedConfig };
      } else {
        // No config file found, use defaults and save it for the first time
        config.value = { ...defaultConfig };
        await writeConfigFile(config.value); // Save the default config
      }
      isConfigLoaded.value = true;
    } catch (err: any) {
      console.error("Error loading or parsing config:", err);
      error.value = `Failed to load configuration: ${err.message}. Using defaults.`;
      config.value = { ...defaultConfig }; // Fallback to defaults on error
      isConfigLoaded.value = true; // Mark as loaded even on error
    } finally {
      isLoading.value = false;
    }
  };

  const saveConfig = async (): Promise<boolean> => {
    isLoading.value = true;
    try {
      await writeConfigFile(config.value);
      return true;
    } catch (err) {
      error.value = `Failed to save configuration: ${err}`;
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  const setDataDirectory = async (newPath: string | null): Promise<boolean> => {
    if (config.value.dataDirectory !== newPath) {
      config.value.dataDirectory = newPath;
      const saved = await saveConfig();
      if (saved) {
        dataDirectoryChangeFlag.value++; // Trigger update only if save succeeded
      }
      return saved;
    }
    return true; // No change was needed
  };

  onMounted(async () => {
    await loadConfig();
  });

  const isDataDirectorySet = computed(() => !!config.value.dataDirectory);

  return {
    config: readonly(config),
    isLoading: readonly(isLoading),
    error: readonly(error),
    isConfigLoaded: readonly(isConfigLoaded),
    isDataDirectorySet,
    loadConfig,
    saveConfig,
    setDataDirectory,
    dataDirectoryChangeFlag: readonly(dataDirectoryChangeFlag),
  };
}
