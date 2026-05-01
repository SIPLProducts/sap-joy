UPDATE public.sap_api_response_fields
   SET map_to_table = 'zmrb_inward_report'
 WHERE config_id = 'f1ac85d4-ca04-497a-bed6-1f509d10b4c2'
   AND sap_field_name IN ('AUFNR','ARBPL','AUART','RUECK');