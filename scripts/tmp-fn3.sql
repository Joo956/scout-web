select pg_get_function_identity_arguments(oid), pg_get_function_result(oid) from pg_proc where proname='create_member_staff_account';
