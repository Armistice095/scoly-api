import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Durée de validité d'une URL signée. Régénérée à la demande, jamais stockée. */
const DUREE_URL_SIGNEE_SECONDES = 60 * 60; // 1h

/**
 * Enveloppe Supabase Storage. Le bucket est privé : personne n'accède aux
 * fichiers via une URL publique, uniquement via des URLs signées générées
 * à la demande par le backend (cf. ARCHITECTURE.md).
 *
 * Générique volontairement : sert aujourd'hui pour les images (logo,
 * signature, cachet) et servira à l'upload des PDF de documents une fois
 * DocumentModule construit — un seul point de contact avec Supabase Storage.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const cleServiceRole = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'scoly';

    if (!url || !cleServiceRole) {
      throw new Error(
        'SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (voir .env.example).',
      );
    }

    // Clé de service, jamais la clé publique "anon" : c'est le backend seul
    // qui parle à Supabase Storage, avec des buckets privés (cf. ARCHITECTURE.md,
    // section "Précisions sur l'usage de Supabase").
    this.client = createClient(url, cleServiceRole);
  }

  /**
   * Envoie un fichier au chemin donné (écrase s'il existe déjà — pratique
   * pour "remplacer le logo"). Retourne le chemin tel quel : c'est lui qu'il
   * faut stocker en base, jamais une URL.
   */
  async televerser(
    chemin: string,
    fichier: Buffer,
    typeContenu: string,
  ): Promise<string> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(chemin, fichier, {
        contentType: typeContenu,
        upsert: true,
      });

    if (error) {
      this.logger.error(
        `Échec de l'upload vers Supabase Storage (${chemin}) : ${error.message}`,
      );
      throw new BadRequestException("Échec de l'envoi du fichier. Réessayez.");
    }

    return chemin;
  }

  /**
   * Génère une URL signée temporaire pour un chemin déjà stocké. À appeler
   * à chaque lecture (ex. dans le mapper de réponse d'EtablissementService),
   * jamais à mettre en cache côté serveur au-delà de la requête en cours.
   */
  async obtenirUrlSignee(
    chemin: string,
    /** Si fourni, le navigateur télécharge le fichier sous ce nom (Content-Disposition: attachment). */
    nomTelechargement?: string,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(
        chemin,
        DUREE_URL_SIGNEE_SECONDES,
        nomTelechargement ? { download: nomTelechargement } : undefined,
      );

    if (error || !data) {
      this.logger.error(
        `Échec de génération d'URL signée (${chemin}) : ${error?.message}`,
      );
      throw new BadRequestException("Impossible d'accéder à ce fichier.");
    }

    return data.signedUrl;
  }

  /**
   * Lit un fichier du bucket (ex. logo à imprimer sur un PDF). Renvoie `null`
   * s'il est introuvable ou illisible : l'appelant décide de continuer sans.
   */
  async telecharger(chemin: string): Promise<Buffer | null> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(chemin);

    if (error || !data) {
      this.logger.warn(
        `Fichier introuvable dans Supabase Storage (${chemin}) : ${error?.message}`,
      );
      return null;
    }
    return Buffer.from(await data.arrayBuffer());
  }

  /** Best-effort : une image orpheline dans le bucket n'est pas critique, on log et on continue. */
  async supprimer(chemin: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([chemin]);
    if (error) {
      this.logger.error(
        `Échec de suppression Supabase Storage (${chemin}) : ${error.message}`,
      );
    }
  }
}
